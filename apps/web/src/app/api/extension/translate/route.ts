import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { translateLyrics } from '@/lib/services/translation';
import {
  lookupCache,
  gateTranslation,
  persistTranslation,
  translateErrorBody,
} from '@/lib/services/translationApi';
import { captureFromRequest } from '@/lib/analytics/server';
import type { LyricLine } from '@/lib/types';

/**
 * Translation endpoint for the Melofy browser extension.
 *
 * The extension already has the (synced) lyric lines from LRCLIB, so this takes
 * plain lines + a target language and returns the translations aligned 1:1 to the
 * input order. It shares the SAME cache/limit/BYOK/error policy as the web route
 * (via lib/services/translationApi) — the only differences are transport (JSON vs
 * NDJSON stream) and lyric source (client-provided vs server-fetched).
 *
 * Public (unlike /api/eval/translate): the extension calls it from its background
 * worker, which holds a host permission and so bypasses CORS. No auth by design.
 */
const Schema = z.object({
  lines: z.array(z.string()).min(1),
  targetLanguage: z.string().min(2),
  artist: z.string().optional(),
  title: z.string().optional(),
  encryptedKey: z.string().optional(),
});

const canonicalLine = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

// Map a translation (web's cached lines OR our fresh output) onto the requested
// lines. Fast path is a 1:1 index map; otherwise match by original text.
function alignToLines(lines: string[], lyrics: LyricLine[]): string[] {
  if (lyrics.length === lines.length) {
    return lyrics.map((l, i) => l.translated || lines[i]);
  }
  const byText = new Map<string, string>();
  for (const l of lyrics) byText.set(canonicalLine(l.original), l.translated || l.original);
  return lines.map((ln) => byText.get(canonicalLine(ln)) ?? ln);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  const { lines, targetLanguage, artist, title, encryptedKey } = parsed.data;
  const canCache = !!artist && !!title;

  // 1) Shared cache — a hit is free (no gate, no model call).
  let hash: string | null = null;
  if (canCache) {
    const lu = await lookupCache(artist!, title!, targetLanguage);
    hash = lu.hash;
    if (lu.lyrics) {
      void captureFromRequest(req, 'translation_completed', {
        surface: 'extension',
        cached: true,
        targetLanguage,
        sourceLanguage: lu.sourceLanguage,
        lineCount: lu.lyrics.length,
      });
      return NextResponse.json({
        translated: alignToLines(lines, lu.lyrics),
        sourceLanguage: lu.sourceLanguage,
        cached: true,
      });
    }
  }

  // 2) Same gate as the web route (BYOK decrypt + per-IP daily limit).
  const gate = await gateTranslation(req, encryptedKey);
  if (!gate.ok) {
    if (gate.status === 429) {
      void captureFromRequest(req, 'rate_limit_hit', { surface: 'extension', targetLanguage });
    }
    return NextResponse.json(gate.body, { status: gate.status });
  }

  const lyrics: LyricLine[] = lines.map((original, index) => ({
    index,
    timeMs: index * 3000,
    durationMs: 3000,
    original,
  }));

  try {
    const { translatedLyrics, sourceLanguage } = await translateLyrics(
      lyrics,
      targetLanguage,
      artist,
      title,
      undefined, // model (use configured default)
      gate.userKey // BYOK override when present
    );

    if (hash && canCache) {
      await persistTranslation(hash, artist!, title!, targetLanguage, sourceLanguage, translatedLyrics);
    }

    void captureFromRequest(req, 'translation_completed', {
      surface: 'extension',
      cached: false,
      targetLanguage,
      sourceLanguage,
      lineCount: translatedLyrics.length,
      byok: !!gate.userKey,
    });
    return NextResponse.json({ translated: alignToLines(lines, translatedLyrics), sourceLanguage });
  } catch (error: any) {
    console.error('[Extension Translate] error:', error);
    const { status, body } = translateErrorBody(error);
    void captureFromRequest(req, 'translation_failed', {
      surface: 'extension',
      targetLanguage,
      code: (body as { code?: string }).code ?? 'ERROR',
    });
    return NextResponse.json(body, { status });
  }
}

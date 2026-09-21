import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/rate-limit';
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
  // Real LRC timings, parallel to `lines` (null where a line is unsynced). The
  // extension holds these client-side; without them we cannot safely cache.
  timeMs: z.array(z.number().nullable()).optional(),
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
  const limited = await enforceRateLimit(req, { bucket: 'ext-translate', limit: 30, windowSec: 60 });
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  const { lines, targetLanguage, artist, title, encryptedKey, timeMs } = parsed.data;

  // The cache is SHARED with the web app, which reads `timeMs` straight out of
  // it to drive the highlight. Entries may only be written when we hold this
  // track's real timings — a placeholder would desync every future web play.
  const hasRealTimings =
    !!timeMs && timeMs.length === lines.length && timeMs.every((t) => typeof t === 'number');
  const canCache = !!artist && !!title && hasRealTimings;

  // 1) Shared cache — a hit is free (no gate, no model call).
  let hash: string | null = null;
  if (artist && title) {
    const lu = await lookupCache(artist, title, targetLanguage);
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

  // Real timings when the client sent them; otherwise evenly-spaced placeholders
  // purely so the translator has a well-formed LyricLine[] — these never persist.
  const lyrics: LyricLine[] = lines.map((original, index) => {
    const t = hasRealTimings ? (timeMs![index] as number) : index * 3000;
    const next = hasRealTimings ? (timeMs![index + 1] as number | undefined) : undefined;
    return { index, timeMs: t, durationMs: next != null ? next - t : 3000, original };
  });

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

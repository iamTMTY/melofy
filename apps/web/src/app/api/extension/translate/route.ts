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

const Schema = z.object({
  lines: z.array(z.string()).min(1),
  // This endpoint is PUBLIC, so the bounds are a trust boundary, not a nicety:
  // a negative or non-finite timestamp written into the SHARED cache would
  // desync the web player for every later listener of that track.
  timeMs: z.array(z.number().finite().nonnegative().nullable()).optional(),
  targetLanguage: z.string().min(2),
  artist: z.string().optional(),
  title: z.string().optional(),
  album: z.string().optional(),
  durationMs: z.number().positive().optional(),
  encryptedKey: z.string().optional(),
});

const canonicalLine = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

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

  const { lines, targetLanguage, artist, title, encryptedKey, timeMs, album, durationMs } = parsed.data;

  // The cache is SHARED with the web app, which reads `timeMs` straight out of
  // it to drive the highlight. Entries may only be written when we hold this
  // track's real timings — a placeholder would desync every future web play.
  // This is all-or-nothing on purpose: a SINGLE null (one unsynced line) disables
  // caching for the whole request, because a partially-timed entry in the shared
  // cache is indistinguishable from a fully-timed one once it is read back.
  const hasRealTimings =
    !!timeMs &&
    timeMs.length === lines.length &&
    timeMs.every(
      (t, i) => typeof t === 'number' && (i === 0 || t >= (timeMs[i - 1] as number))
    );
  const canCache = !!artist && !!title && hasRealTimings;

  let hash: string | null = null;
  if (artist && title) {
    const lu = await lookupCache(artist, title, targetLanguage, { album, durationMs });
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

  const gate = await gateTranslation(req, encryptedKey);
  if (!gate.ok) {
    if (gate.status === 429) {
      void captureFromRequest(req, 'rate_limit_hit', { surface: 'extension', targetLanguage });
    }
    return NextResponse.json(gate.body, { status: gate.status });
  }

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
      undefined,
      gate.userKey
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

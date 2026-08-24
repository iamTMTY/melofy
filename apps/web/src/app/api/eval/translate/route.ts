import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { translateLyrics } from '@/lib/services/translation';
import type { LyricLine } from '@/lib/types';

/**
 * DEV-ONLY translation endpoint for the eval harness.
 *
 * Unlike /api/translation/translate, this takes ALREADY-STORED lyric lines and a
 * model, and runs ONLY the translation service — no LRCLIB fetch, no Mongo/Redis
 * cache. That makes each eval run deterministic (same input every time) and lets
 * the harness drive an arbitrary model per request, while still exercising the
 * EXACT prompt + parsing + retry logic the app ships. It returns the translated
 * lines aligned 1:1 with the input order.
 *
 * Guarded: 404s in production so the model override can never be driven publicly.
 */
const EvalTranslateSchema = z.object({
  lines: z.array(z.string()).min(1),
  targetLanguage: z.string().min(2),
  model: z.string().min(1),
  artist: z.string().optional(),
  title: z.string().optional(),
});

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = EvalTranslateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { lines, targetLanguage, model, artist, title } = parsed.data;

  // The stored source is plain text (no timecodes). Give each line a synthetic,
  // monotonic timestamp so the pipeline's timecode-based line matching works;
  // the timings are irrelevant to the eval — only the translated text matters.
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
      model
    );
    const translated = translatedLyrics.map((l) => l.translated ?? l.original);
    return NextResponse.json({ translated, sourceLanguage, model });
  } catch (error: any) {
    console.error('[Eval Translate] error:', error);
    return NextResponse.json(
      { error: error?.message || 'Translation failed', model },
      { status: 500 }
    );
  }
}

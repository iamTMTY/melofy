import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/rate-limit';
import { translateLyricsStreaming } from '@/lib/services/translation';
import { fetchLyrics } from '@/lib/services/lyrics';
import {
  lookupCache,
  gateTranslation,
  persistTranslation,
  translateErrorBody,
} from '@/lib/services/translationApi';
import { captureFromRequest } from '@/lib/analytics/server';
import type { LyricLine } from '@/lib/types';

const TranslateRequestSchema = z.object({
  artist: z.string().min(1),
  title: z.string().min(1),
  targetLanguage: z.string().min(2).max(5),
  // Optional BYOK key, RSA-OAEP-encrypted for this server's public key.
  encryptedKey: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, { bucket: 'translate', limit: 30, windowSec: 60 });
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = TranslateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  const { artist, title, targetLanguage, encryptedKey } = parsed.data;

  // Everything that can fail with a real HTTP status happens BEFORE the stream
  // opens (cache lookup, lyrics fetch, gate) — all via the shared policy.
  const { hash, lyrics: cachedLyrics, sourceLanguage: cachedSourceLanguage } = await lookupCache(
    artist,
    title,
    targetLanguage
  );

  let originalLyrics: LyricLine[] = [];
  let userKey: string | undefined;

  if (!cachedLyrics) {
    try {
      originalLyrics = await fetchLyrics(artist, title);
    } catch (error: any) {
      return NextResponse.json({ error: error?.message || 'Translation failed' }, { status: 500 });
    }
    if (originalLyrics.length === 0) {
      return NextResponse.json({ error: 'Lyrics not found for this track', code: 'NO_LYRICS' }, { status: 404 });
    }

    const gate = await gateTranslation(req, encryptedKey);
    if (!gate.ok) {
      if (gate.status === 429) {
        void captureFromRequest(req, 'rate_limit_hit', { surface: 'web', targetLanguage });
      }
      return NextResponse.json(gate.body, { status: gate.status });
    }
    userKey = gate.userKey;
  }

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, obj: unknown) =>
    controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Cache hit → deliver the whole set in one shot.
        if (cachedLyrics) {
          send(controller, { type: 'full', lyrics: cachedLyrics, hash, sourceLanguage: cachedSourceLanguage, cached: true });
          controller.close();
          void captureFromRequest(req, 'translation_completed', {
            surface: 'web',
            cached: true,
            targetLanguage,
            sourceLanguage: cachedSourceLanguage,
            lineCount: cachedLyrics.length,
          });
          return;
        }

        // Fresh translation → stream each line as it arrives.
        const { translatedLyrics, sourceLanguage } = await translateLyricsStreaming(
          originalLyrics,
          targetLanguage,
          (line) => send(controller, { type: 'line', line }),
          artist,
          title,
          undefined, // model (use configured default)
          userKey // BYOK override when present
        );

        await persistTranslation(hash, artist, title, targetLanguage, sourceLanguage, translatedLyrics);

        send(controller, { type: 'done', hash, sourceLanguage, cached: false });
        controller.close();
        void captureFromRequest(req, 'translation_completed', {
          surface: 'web',
          cached: false,
          targetLanguage,
          sourceLanguage,
          lineCount: translatedLyrics.length,
          byok: !!userKey,
        });
      } catch (error: any) {
        console.error('[Translation Route] Stream error:', error);
        const { body } = translateErrorBody(error);
        send(controller, { type: 'error', ...body });
        controller.close();
        void captureFromRequest(req, 'translation_failed', {
          surface: 'web',
          targetLanguage,
          code: (body as { code?: string }).code ?? 'ERROR',
        });
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

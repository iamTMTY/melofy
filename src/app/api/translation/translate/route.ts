import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateHash, getCachedTranslation, saveCachedTranslation } from '@/lib/services/cache';
import { translateLyrics } from '@/lib/services/translation';
import { fetchLyrics } from '@/lib/services/lyrics';
import { connectMongoDB } from '@/lib/db/mongodb';

const TranslateRequestSchema = z.object({
  artist: z.string().min(1),
  title: z.string().min(1),
  targetLanguage: z.string().min(2).max(5),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = TranslateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { artist, title, targetLanguage } = parsed.data;
    const hash = generateHash(artist, title, targetLanguage);

    await connectMongoDB();

    const cached = await getCachedTranslation(hash);
    if (cached.found && cached.lyrics) {
      return NextResponse.json({
        hash,
        lyrics: cached.lyrics,
        cached: true,
        sourceLanguage: cached.sourceLanguage || 'unknown',
      });
    }

    const originalLyrics = await fetchLyrics(artist, title);
    if (originalLyrics.length === 0) {
      return NextResponse.json(
        { error: 'Lyrics not found for this track' },
        { status: 404 }
      );
    }

    const { translatedLyrics, sourceLanguage } = await translateLyrics(
      originalLyrics,
      targetLanguage
    );

    await saveCachedTranslation({
      hash,
      artist,
      title,
      sourceLanguage,
      targetLanguage,
      lyrics: translatedLyrics,
    });

    return NextResponse.json({
      hash,
      lyrics: translatedLyrics,
      cached: false,
      sourceLanguage,
    });
  } catch (error: any) {
    console.error('[Translation Route] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Translation failed' },
      { status: 500 }
    );
  }
}

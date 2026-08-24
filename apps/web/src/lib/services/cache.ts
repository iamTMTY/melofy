import crypto from 'crypto';
import { CachedTranslation } from '../db/models/CachedTranslation';
import { getRedisClient } from '../db/redis';
import { config } from '../config';
import type { LyricLine } from '@/lib/types';

// Canonicalize so the SAME song hashes identically regardless of how the source
// encodes it: Unicode NFC (á/ọ as one code point, not letter + combining mark),
// straightened apostrophes/quotes (curly ’ vs straight '), collapsed whitespace,
// lowercased. Without this, diacritic-heavy titles (Yoruba, etc.) miss the cache.
function canonical(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[‘’ʼ‛`´]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function generateHash(artist: string, title: string, targetLanguage: string): string {
  const raw = `${canonical(artist)}|${canonical(title)}|${targetLanguage.toLowerCase().trim()}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function getCachedTranslation(
  hash: string
): Promise<{ found: boolean; lyrics?: LyricLine[]; sourceLanguage?: string }> {
  const redis = getRedisClient();

  try {
    const cachedJson = await redis.get(`lyrics:${hash}`);
    if (cachedJson) {
      const parsed = JSON.parse(cachedJson);
      return { found: true, lyrics: parsed.lyrics, sourceLanguage: parsed.sourceLanguage };
    }
  } catch {}

  try {
    const doc = await CachedTranslation.findOne({ hash, flaggedInaccurate: false }).lean() as any;
    if (doc) {
      const result = {
        found: true as const,
        lyrics: doc.lyrics.map((l: any) => ({
          index: l.index,
          timeMs: l.timeMs,
          durationMs: l.durationMs,
          original: l.original,
          translated: l.translated,
        })),
        sourceLanguage: doc.sourceLanguage,
      };

      try {
        await redis.setex(`lyrics:${hash}`, config.cacheTtlSeconds, JSON.stringify(result));
      } catch {}

      return result;
    }
  } catch (err) {
    console.error('[Cache] MongoDB lookup error:', err);
  }

  return { found: false };
}

export async function saveCachedTranslation(params: {
  hash: string;
  artist: string;
  title: string;
  sourceLanguage: string;
  targetLanguage: string;
  lyrics: LyricLine[];
}): Promise<void> {
  const redis = getRedisClient();

  try {
    await CachedTranslation.findOneAndUpdate(
      { hash: params.hash },
      {
        hash: params.hash,
        artist: params.artist,
        title: params.title,
        sourceLanguage: params.sourceLanguage,
        targetLanguage: params.targetLanguage,
        lyrics: params.lyrics.map((l) => ({
          index: l.index,
          timeMs: l.timeMs,
          durationMs: l.durationMs,
          original: l.original,
          translated: l.translated || '',
        })),
        flaggedInaccurate: false,
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('[Cache] MongoDB save error:', err);
  }

  try {
    const cacheData = {
      found: true,
      lyrics: params.lyrics,
      sourceLanguage: params.sourceLanguage,
    };
    await redis.setex(`lyrics:${params.hash}`, config.cacheTtlSeconds, JSON.stringify(cacheData));
  } catch (err) {
    console.error('[Cache] Redis save error:', err);
  }
}

export async function flagTranslationInaccurate(hash: string): Promise<void> {
  const redis = getRedisClient();

  try {
    await CachedTranslation.findOneAndUpdate({ hash }, { flaggedInaccurate: true });
  } catch (err) {
    console.error('[Cache] Flag inaccurate error:', err);
  }

  try {
    await redis.del(`lyrics:${hash}`);
  } catch {}
}

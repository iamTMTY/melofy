import type { NextRequest } from 'next/server';
import { generateHash, getCachedTranslation, saveCachedTranslation, type RecordingId } from './cache';
import { connectMongoDB } from '../db/mongodb';
import { consumeTranslation } from '../rate-limit';
import { decryptApiKey } from '../byok/serverKeys';
import type { LyricLine } from '@/lib/types';

export interface CacheLookup {
  hash: string;
  lyrics: LyricLine[] | null;
  sourceLanguage: string;
}

export async function lookupCache(
  artist: string,
  title: string,
  targetLanguage: string,
  recording?: RecordingId
): Promise<CacheLookup> {
  const hash = generateHash(artist, title, targetLanguage, recording);
  try {
    await connectMongoDB();
    const cached = await getCachedTranslation(hash);
    if (cached.found && cached.lyrics?.length) {
      return { hash, lyrics: cached.lyrics, sourceLanguage: cached.sourceLanguage || 'unknown' };
    }
  } catch {}
  return { hash, lyrics: null, sourceLanguage: 'unknown' };
}

export type GateResult =
  | { ok: true; userKey?: string }
  | { ok: false; status: number; body: Record<string, unknown> };

export async function gateTranslation(req: NextRequest, encryptedKey?: string): Promise<GateResult> {
  if (encryptedKey) {
    try {
      return { ok: true, userKey: decryptApiKey(encryptedKey) };
    } catch {
      return {
        ok: false,
        status: 400,
        body: { error: 'Could not read your API key. Refresh and try again.', code: 'BYOK_DECRYPT_FAILED' },
      };
    }
  }
  const rl = await consumeTranslation(req);
  if (!rl.allowed) {
    return {
      ok: false,
      status: 429,
      body: {
        error: "You've used up today's free translations.",
        code: 'RATE_LIMIT',
        resetAt: rl.resetAt,
      },
    };
  }
  return { ok: true };
}

export async function persistTranslation(
  hash: string,
  artist: string,
  title: string,
  targetLanguage: string,
  sourceLanguage: string,
  lyrics: LyricLine[]
): Promise<void> {
  try {
    await saveCachedTranslation({ hash, artist, title, sourceLanguage, targetLanguage, lyrics });
  } catch {}
}

export function translateErrorBody(error: unknown): { status: number; body: Record<string, unknown> } {
  const e = error as { status?: number; message?: string };
  const is429 = e?.status === 429 || /\b429\b/.test(String(e?.message ?? ''));
  return is429
    ? { status: 429, body: { error: "You've used up today's free translations.", code: 'RATE_LIMIT' } }
    : { status: 500, body: { error: 'Something went wrong translating this song.' } };
}

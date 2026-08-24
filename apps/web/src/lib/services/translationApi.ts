import type { NextRequest } from 'next/server';
import { generateHash, getCachedTranslation, saveCachedTranslation } from './cache';
import { connectMongoDB } from '../db/mongodb';
import { consumeTranslation } from '../rate-limit';
import { decryptApiKey } from '../byok/serverKeys';
import type { LyricLine } from '@/lib/types';

// Shared server-side translation policy, used identically by BOTH the web
// streaming route and the extension route, so cache/limit/BYOK/error behavior
// can't drift between them. The routes differ only in transport (NDJSON stream
// vs JSON) and lyric source (server-fetched vs client-provided).

export interface CacheLookup {
  hash: string;
  lyrics: LyricLine[] | null; // null = miss
  sourceLanguage: string;
}

/** Hash the track and read the shared cache (Redis → Mongo). */
export async function lookupCache(artist: string, title: string, targetLanguage: string): Promise<CacheLookup> {
  const hash = generateHash(artist, title, targetLanguage);
  try {
    await connectMongoDB();
    const cached = await getCachedTranslation(hash);
    if (cached.found && cached.lyrics?.length) {
      return { hash, lyrics: cached.lyrics, sourceLanguage: cached.sourceLanguage || 'unknown' };
    }
  } catch {
    /* treat cache/db errors as a miss */
  }
  return { hash, lyrics: null, sourceLanguage: 'unknown' };
}

export type GateResult =
  | { ok: true; userKey?: string }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Gate a NEW translation (call only on a cache miss — a hit costs nothing).
 * A BYOK key (decrypted in memory, never stored/logged) bypasses the shared
 * per-IP daily limit; otherwise one unit of the free budget is consumed.
 */
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

/** Persist a fresh translation to the shared cache (best-effort). */
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
  } catch {
    /* best-effort */
  }
}

/** Map a translation failure to a client response (provider 429 → friendly quota). */
export function translateErrorBody(error: unknown): { status: number; body: Record<string, unknown> } {
  const e = error as { status?: number; message?: string };
  const is429 = e?.status === 429 || /\b429\b/.test(String(e?.message ?? ''));
  return is429
    ? { status: 429, body: { error: "You've used up today's free translations.", code: 'RATE_LIMIT' } }
    : { status: 500, body: { error: 'Something went wrong translating this song.' } };
}

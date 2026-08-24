import { openDB, type IDBPDatabase } from 'idb';
import type { LyricLine } from '@/lib/types';

// Client-side translation cache (IndexedDB). Sits IN FRONT of the server's
// Redis/Mongo cache: a hit here means no network at all — instant lyrics, no
// server load, and (crucially) no model/Gemini call. Also enables offline replay
// of already-seen songs.
//
// Everything degrades gracefully: if IndexedDB is unavailable (SSR, private mode)
// or any op throws, reads return null and writes no-op, so the network path — the
// source of truth — always still works.

const DB_NAME = 'melofy';
const STORE = 'translations';
const DB_VERSION = 1;

/**
 * Bump to invalidate ALL client-cached translations — e.g. after changing the
 * translation model or the prompt. Entries whose `cacheVersion` differs are
 * ignored on read and lazily deleted. (When the app switched gpt-4o → Gemini,
 * bumping this is what purges browsers' stale copies.)
 */
export const CACHE_VERSION = 1;

const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // positive entries: 90 days
const NEG_MAX_AGE_MS = 24 * 60 * 60 * 1000; // negative ("no lyrics"): 1 day
const MAX_ENTRIES = 500; // ~1–2 MB; LRU-evicted by lastAccess

interface CacheEntry {
  key: string;
  lyrics: LyricLine[] | null; // null on a negative entry
  sourceLanguage: string;
  hash: string;
  negative?: boolean;
  cacheVersion: number;
  createdAt: number;
  lastAccess: number;
}

export interface CacheHit {
  lyrics: LyricLine[] | null;
  sourceLanguage: string;
  hash: string;
  negative: boolean;
}

function makeKey(artist: string, title: string, lang: string): string {
  // Mirror the server's hash normalization so keys line up conceptually.
  return `${artist.toLowerCase().trim()}|${title.toLowerCase().trim()}|${lang}`;
}

let dbPromise: Promise<IDBPDatabase | null> | null = null;
function getDB(): Promise<IDBPDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('lastAccess', 'lastAccess');
      },
    }).catch(() => null);
  }
  return dbPromise;
}

/** Look up a cached translation. Returns null on miss/expiry/version-mismatch. */
export async function getCachedTranslation(
  artist: string,
  title: string,
  lang: string
): Promise<CacheHit | null> {
  try {
    const db = await getDB();
    if (!db) return null;
    const key = makeKey(artist, title, lang);
    const e = (await db.get(STORE, key)) as CacheEntry | undefined;
    if (!e) return null;

    const maxAge = e.negative ? NEG_MAX_AGE_MS : MAX_AGE_MS;
    if (e.cacheVersion !== CACHE_VERSION || Date.now() - e.createdAt > maxAge) {
      db.delete(STORE, key).catch(() => {});
      return null;
    }

    // Touch lastAccess for LRU (fire-and-forget).
    e.lastAccess = Date.now();
    db.put(STORE, e).catch(() => {});

    return { lyrics: e.lyrics, sourceLanguage: e.sourceLanguage, hash: e.hash, negative: !!e.negative };
  } catch {
    return null;
  }
}

async function putEntry(entry: CacheEntry): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    await db.put(STORE, entry);
    await evictIfNeeded(db);
  } catch {
    /* ignore quota / transaction errors */
  }
}

/** Store a successful translation. */
export async function putCachedTranslation(args: {
  artist: string;
  title: string;
  lang: string;
  lyrics: LyricLine[];
  sourceLanguage: string;
  hash: string;
}): Promise<void> {
  const now = Date.now();
  await putEntry({
    key: makeKey(args.artist, args.title, args.lang),
    lyrics: args.lyrics,
    sourceLanguage: args.sourceLanguage,
    hash: args.hash,
    cacheVersion: CACHE_VERSION,
    createdAt: now,
    lastAccess: now,
  });
}

/** Remember that a track has no lyrics, so repeat plays skip the lyrics fetch. */
export async function putNegativeCache(artist: string, title: string, lang: string): Promise<void> {
  const now = Date.now();
  await putEntry({
    key: makeKey(artist, title, lang),
    lyrics: null,
    sourceLanguage: 'unknown',
    hash: '',
    negative: true,
    cacheVersion: CACHE_VERSION,
    createdAt: now,
    lastAccess: now,
  });
}

/** Remove one entry (e.g. when the user flags a translation as inaccurate). */
export async function deleteCachedTranslation(artist: string, title: string, lang: string): Promise<void> {
  try {
    const db = await getDB();
    if (db) await db.delete(STORE, makeKey(artist, title, lang));
  } catch {
    /* ignore */
  }
}

/** Drop every cached translation. */
export async function clearTranslationCache(): Promise<void> {
  try {
    const db = await getDB();
    if (db) await db.clear(STORE);
  } catch {
    /* ignore */
  }
}

// Evict the least-recently-accessed entries once the store exceeds MAX_ENTRIES.
async function evictIfNeeded(db: IDBPDatabase): Promise<void> {
  try {
    const count = await db.count(STORE);
    if (count <= MAX_ENTRIES) return;
    let toDrop = count - MAX_ENTRIES;
    const tx = db.transaction(STORE, 'readwrite');
    let cursor = await tx.store.index('lastAccess').openCursor(); // ascending = oldest first
    while (cursor && toDrop > 0) {
      await cursor.delete();
      toDrop--;
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch {
    /* ignore */
  }
}

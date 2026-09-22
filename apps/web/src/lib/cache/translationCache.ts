import { openDB, type IDBPDatabase } from 'idb';
import type { LyricLine } from '@/lib/types';

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

const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const NEG_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;

interface CacheEntry {
  key: string;
  lyrics: LyricLine[] | null;
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

export interface CacheRecording {
  album?: string;
  durationMs?: number;
}

function makeKey(artist: string, title: string, lang: string, rec?: CacheRecording): string {
  const secs = rec?.durationMs && rec.durationMs > 0 ? Math.round(rec.durationMs / 1000) : '';
  const album = (rec?.album ?? '').toLowerCase().trim();
  const part = !album && secs === '' ? '' : `|${album}|${secs}`;
  return `${artist.toLowerCase().trim()}|${title.toLowerCase().trim()}|${lang}${part}`;
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

export const translationCacheKeyForTest = makeKey;

export async function getCachedTranslation(
  artist: string,
  title: string,
  lang: string,
  recording?: CacheRecording
): Promise<CacheHit | null> {
  try {
    const db = await getDB();
    if (!db) return null;
    const key = makeKey(artist, title, lang, recording);
    const e = (await db.get(STORE, key)) as CacheEntry | undefined;
    if (!e) return null;

    const maxAge = e.negative ? NEG_MAX_AGE_MS : MAX_AGE_MS;
    if (e.cacheVersion !== CACHE_VERSION || Date.now() - e.createdAt > maxAge) {
      db.delete(STORE, key).catch(() => {});
      return null;
    }

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
  } catch {}
}

export async function putCachedTranslation(args: {
  artist: string;
  title: string;
  lang: string;
  lyrics: LyricLine[];
  sourceLanguage: string;
  hash: string;
  recording?: CacheRecording;
}): Promise<void> {
  const now = Date.now();
  await putEntry({
    key: makeKey(args.artist, args.title, args.lang, args.recording),
    lyrics: args.lyrics,
    sourceLanguage: args.sourceLanguage,
    hash: args.hash,
    cacheVersion: CACHE_VERSION,
    createdAt: now,
    lastAccess: now,
  });
}

export async function putNegativeCache(
  artist: string,
  title: string,
  lang: string,
  recording?: CacheRecording
): Promise<void> {
  const now = Date.now();
  await putEntry({
    key: makeKey(artist, title, lang, recording),
    lyrics: null,
    sourceLanguage: 'unknown',
    hash: '',
    negative: true,
    cacheVersion: CACHE_VERSION,
    createdAt: now,
    lastAccess: now,
  });
}

export async function deleteCachedTranslation(
  artist: string,
  title: string,
  lang: string,
  recording?: CacheRecording
): Promise<void> {
  try {
    const db = await getDB();
    if (db) await db.delete(STORE, makeKey(artist, title, lang, recording));
  } catch {}
}

export async function clearTranslationCache(): Promise<void> {
  try {
    const db = await getDB();
    if (db) await db.clear(STORE);
  } catch {}
}

async function evictIfNeeded(db: IDBPDatabase): Promise<void> {
  try {
    const count = await db.count(STORE);
    if (count <= MAX_ENTRIES) return;
    let toDrop = count - MAX_ENTRIES;
    const tx = db.transaction(STORE, 'readwrite');
    let cursor = await tx.store.index('lastAccess').openCursor();
    while (cursor && toDrop > 0) {
      await cursor.delete();
      toDrop--;
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch {}
}

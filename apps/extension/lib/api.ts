import type { GetLyricsReq, GetLyricsRes, TranslateReq, TranslateRes } from './messages';
import { translationCacheKey } from './config';

/**
 * Ask the background worker for LRCLIB lyrics for a track. This is a runtime
 * message, not an HTTP call — background.ts fetches lrclib.net itself. The web
 * app's /api/lyrics/search is NOT involved and its 422 behaviour does not apply.
 */
export function requestLyrics(req: Omit<GetLyricsReq, 'type'>): Promise<GetLyricsRes> {
  return browser.runtime.sendMessage({ type: 'GET_LYRICS', ...req } satisfies GetLyricsReq);
}

/** Ask the background worker to translate lines via the Melofy API. */
export function requestTranslation(req: Omit<TranslateReq, 'type'>): Promise<TranslateRes> {
  return browser.runtime.sendMessage({ type: 'TRANSLATE', ...req } satisfies TranslateReq);
}

// --- per-track translation cache (browser.storage.local) --------------------
// Avoids re-calling (and re-paying for) translation when a song replays.

export interface CacheRecording {
  album?: string;
  durationMs?: number;
}

export async function getCachedTranslation(
  artist: string,
  title: string,
  lang: string,
  recording?: CacheRecording
): Promise<string[] | null> {
  const key = translationCacheKey(artist, title, lang, recording);
  const r = await browser.storage.local.get(key);
  const v = r[key] as { translated: string[] } | undefined;
  return v?.translated ?? null;
}

export async function setCachedTranslation(
  artist: string,
  title: string,
  lang: string,
  translated: string[],
  recording?: CacheRecording
): Promise<void> {
  const key = translationCacheKey(artist, title, lang, recording);
  await browser.storage.local.set({ [key]: { translated, at: Date.now() } });
}

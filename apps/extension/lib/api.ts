import type { GetLyricsReq, GetLyricsRes, TranslateReq, TranslateRes } from './messages';
import { translationCacheKey } from './config';

/** Ask the background worker for LRCLIB lyrics for a track. */
export function requestLyrics(req: Omit<GetLyricsReq, 'type'>): Promise<GetLyricsRes> {
  return browser.runtime.sendMessage({ type: 'GET_LYRICS', ...req } satisfies GetLyricsReq);
}

/** Ask the background worker to translate lines via the Melofy API. */
export function requestTranslation(req: Omit<TranslateReq, 'type'>): Promise<TranslateRes> {
  return browser.runtime.sendMessage({ type: 'TRANSLATE', ...req } satisfies TranslateReq);
}

// --- per-track translation cache (browser.storage.local) --------------------
// Avoids re-calling (and re-paying for) translation when a song replays.

export async function getCachedTranslation(
  artist: string,
  title: string,
  lang: string
): Promise<string[] | null> {
  const key = translationCacheKey(artist, title, lang);
  const r = await browser.storage.local.get(key);
  const v = r[key] as { translated: string[] } | undefined;
  return v?.translated ?? null;
}

export async function setCachedTranslation(
  artist: string,
  title: string,
  lang: string,
  translated: string[]
): Promise<void> {
  const key = translationCacheKey(artist, title, lang);
  await browser.storage.local.set({ [key]: { translated, at: Date.now() } });
}

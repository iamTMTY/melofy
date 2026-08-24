import { MELOFY_API_BASE } from '../lib/config';
import { parseLrc, parsePlain } from '../lib/lrc';
import { getEncryptedKey } from '../lib/byok';
import { sendTrackEvent } from '../lib/analytics';
import type { GetLyricsReq, GetLyricsRes, Req, TranslateReq, TranslateRes } from '../lib/messages';

// The background worker performs all cross-origin fetches (LRCLIB + the Melofy
// API). With host_permissions granted, these bypass page CORS. Phase 3 will also
// forward now-playing to the Melofy web app from here.
export default defineBackground(() => {
  console.log('[Melofy] background service worker ready');

  browser.runtime.onMessage.addListener((msg: Req, _sender, sendResponse) => {
    if (msg?.type === 'GET_LYRICS') {
      handleGetLyrics(msg).then(sendResponse);
      return true; // async response
    }
    if (msg?.type === 'TRANSLATE') {
      handleTranslate(msg).then(sendResponse);
      return true;
    }
    if (msg?.type === 'TRACK') {
      void sendTrackEvent(msg); // fire-and-forget; no response needed
      return false;
    }
    return false;
  });
});

async function handleGetLyrics(msg: GetLyricsReq): Promise<GetLyricsRes> {
  try {
    const params = new URLSearchParams({ artist_name: msg.artist, track_name: msg.title });
    if (msg.album) params.set('album_name', msg.album);
    if (msg.durationMs) params.set('duration', String(Math.round(msg.durationMs / 1000)));

    // Exact match first, then fall back to free-text search.
    let d: any = null;
    const getRes = await fetch(`https://lrclib.net/api/get?${params.toString()}`);
    if (getRes.ok) d = await getRes.json();

    if (!d || (!d.syncedLyrics && !d.plainLyrics)) {
      const q = encodeURIComponent(`${msg.title} ${msg.artist}`);
      const searchRes = await fetch(`https://lrclib.net/api/search?q=${q}`);
      const arr = searchRes.ok ? await searchRes.json() : [];
      d = Array.isArray(arr) ? arr.find((x: any) => x.syncedLyrics || x.plainLyrics) : null;
    }

    if (d?.syncedLyrics) return { ok: true, lines: parseLrc(d.syncedLyrics), synced: true };
    if (d?.plainLyrics) return { ok: true, lines: parsePlain(d.plainLyrics), synced: false };
    return { ok: false, error: 'No lyrics found for this track.' };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Lyrics fetch failed' };
  }
}

async function handleTranslate(msg: TranslateReq): Promise<TranslateRes> {
  try {
    const encryptedKey = await getEncryptedKey(); // BYOK, null if none set
    const res = await fetch(`${MELOFY_API_BASE}/api/extension/translate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        lines: msg.lines,
        targetLanguage: msg.targetLanguage,
        artist: msg.artist,
        title: msg.title,
        encryptedKey: encryptedKey ?? undefined,
      }),
    });
    if (!res.ok) {
      let error = `Translation failed (HTTP ${res.status})`;
      try {
        error = (await res.json()).error || error;
      } catch {
        /* keep default */
      }
      return { ok: false, error };
    }
    const d: any = await res.json();
    return { ok: true, translated: d.translated, sourceLanguage: d.sourceLanguage };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Could not reach the Melofy API. Is it running?' };
  }
}

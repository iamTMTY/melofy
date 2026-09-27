import { MELOFY_API_BASE } from '../lib/config';
import { parseLrc, parsePlain } from '../lib/lrc';
import { getEncryptedKey } from '../lib/byok';
import { sendTrackEvent } from '../lib/analytics';
import type { GetLyricsReq, GetLyricsRes, Req, TranslateReq, TranslateRes } from '../lib/messages';

export default defineBackground(() => {
  console.log('[Melofy] background service worker ready');

  browser.runtime.onMessage.addListener((msg: Req, _sender, sendResponse) => {
    if (msg?.type === 'GET_LYRICS') {
      handleGetLyrics(msg).then(sendResponse);
      return true;
    }
    if (msg?.type === 'TRANSLATE') {
      handleTranslate(msg).then(sendResponse);
      return true;
    }
    if (msg?.type === 'TRACK') {
      void sendTrackEvent(msg);
      return false;
    }
    return false;
  });
});

async function handleGetLyrics(msg: GetLyricsReq): Promise<GetLyricsRes> {
  let serviceError = false;
  const fetchJson = async (url: string): Promise<any> => {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      if (res.status !== 404) serviceError = true;
    } catch {
      serviceError = true;
    }
    return null;
  };
  const parseRecord = (value: any): GetLyricsRes | null => {
    if (value?.syncedLyrics) {
      const lines = parseLrc(value.syncedLyrics);
      if (lines.length) return { ok: true, lines, synced: lines.some((line) => line.timeMs !== null) };
    }
    if (value?.plainLyrics) {
      const lines = parsePlain(value.plainLyrics);
      if (lines.length) return { ok: true, lines, synced: false };
    }
    return null;
  };
  const baseParams = new URLSearchParams({ artist_name: msg.artist, track_name: msg.title });
  const exactParams = new URLSearchParams(baseParams);
  if (msg.album) exactParams.set('album_name', msg.album);
  if (msg.durationMs) exactParams.set('duration', String(Math.round(msg.durationMs / 1000)));

  let result = parseRecord(await fetchJson(`https://lrclib.net/api/get?${exactParams}`));
  if (!result && exactParams.toString() !== baseParams.toString()) {
    // Album and duration can be stale while YTM switches tracks.
    result = parseRecord(await fetchJson(`https://lrclib.net/api/get?${baseParams}`));
  }
  if (!result) {
    const q = encodeURIComponent(`${msg.title} ${msg.artist}`);
    const matches = await fetchJson(`https://lrclib.net/api/search?q=${q}`);
    if (Array.isArray(matches)) {
      for (const match of matches) {
        result = parseRecord(match);
        if (result) break;
      }
    }
  }

  return result ?? { ok: false, error: serviceError ? 'Lyrics service is temporarily unavailable. Try again.' : 'No lyrics found for this track.' };
}

async function handleTranslate(msg: TranslateReq): Promise<TranslateRes> {
  try {
    const encryptedKey = await getEncryptedKey();
    const res = await fetch(`${MELOFY_API_BASE}/api/extension/translate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        lines: msg.lines,
        timeMs: msg.timeMs,
        targetLanguage: msg.targetLanguage,
        artist: msg.artist,
        title: msg.title,
        album: msg.album,
        durationMs: msg.durationMs,
        encryptedKey: encryptedKey ?? undefined,
      }),
    });
    if (!res.ok) {
      let error = `Translation failed (HTTP ${res.status})`;
      try {
        error = (await res.json()).error || error;
      } catch {}
      return { ok: false, error };
    }
    const d: any = await res.json();
    return { ok: true, translated: d.translated, sourceLanguage: d.sourceLanguage };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Could not reach the Melofy API. Is it running?' };
  }
}

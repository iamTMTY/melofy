'use client';

import { useCallback, useRef } from 'react';
import { useMelofy } from './useMelofy';
import type { LyricLine } from '@/lib/types';
import {
  getCachedTranslation,
  putCachedTranslation,
  putNegativeCache,
  deleteCachedTranslation,
} from '@/lib/cache/translationCache';
import { getEncryptedKeyForRequest } from '@/lib/byok/client';

export function useTranslation() {
  const {
    playback,
    preferences,
    setTranslatedLyrics,
    setStreamingLyrics,
    setLoading,
    setTranslating,
    setTranslationError,
    clearLyrics,
  } = useMelofy();

  // Tracks the in-flight request so a song/language switch can abort it before
  // starting the next one — otherwise a superseded stream would keep writing
  // stale lines into the view.
  const abortRef = useRef<AbortController | null>(null);

  const fetchTranslation = useCallback(async () => {
    const { track } = playback;
    if (!track) return;
    const lang = preferences.targetLanguage;

    abortRef.current?.abort();

    // Client cache (IndexedDB) FIRST — a hit means no network and no model call.
    const cached = await getCachedTranslation(track.artist, track.title, lang);
    if (cached) {
      if (cached.negative) {
        setTranslationError("I couldn't find lyrics for this track.");
        setLoading(false);
      } else if (cached.lyrics) {
        setTranslatedLyrics(cached.lyrics, cached.hash, cached.sourceLanguage);
      }
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setTranslationError(null);
    setLoading(true);

    try {
      // Fast "no lyrics" check before committing to the (streaming) translation.
      const lyricsRes = await fetch(
        `/api/lyrics/search?artist=${encodeURIComponent(track.artist)}&title=${encodeURIComponent(track.title)}`,
        { signal }
      );

      if (!lyricsRes.ok) {
        void putNegativeCache(track.artist, track.title, lang);
        setTranslationError("I couldn't find lyrics for this track.");
        setLoading(false);
        return;
      }

      const { lyrics } = await lyricsRes.json();
      if (!lyrics || lyrics.length === 0) {
        void putNegativeCache(track.artist, track.title, lang);
        setTranslationError("I couldn't find lyrics for this track.");
        setLoading(false);
        return;
      }

      setLoading(false);
      setTranslating(true);

      // Attach the user's BYOK key, RSA-OAEP-encrypted for the server (null if none).
      let encryptedKey = await getEncryptedKeyForRequest();
      const postTranslate = (ek: string | null) =>
        fetch('/api/translation/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artist: track.artist,
            title: track.title,
            targetLanguage: lang,
            encryptedKey: ek ?? undefined,
          }),
          signal,
        });

      let res = await postTranslate(encryptedKey);

      // If the server couldn't decrypt our key (ephemeral keypair rotated on a
      // restart), refresh its public key and retry once.
      if (!res.ok && encryptedKey) {
        const peek = await res.clone().json().catch(() => null);
        if (peek?.code === 'BYOK_DECRYPT_FAILED') {
          encryptedKey = await getEncryptedKeyForRequest(true);
          res = await postTranslate(encryptedKey);
        }
      }

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Translation failed' }));
        setTranslationError(err.error || 'Something went wrong translating this song.', err.code ?? null);
        setTranslating(false);
        return;
      }

      // Consume the NDJSON stream, painting lines as they arrive.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const accumulated: LyricLine[] = [];
      let buffer = '';
      let hash = '';
      let sourceLanguage = 'unknown';
      let serverError: string | null = null;
      let serverErrorCode: string | null = null;
      let finalized = false;

      // Throttle re-renders — lines can arrive dozens per second.
      let lastFlush = 0;
      const flush = () => {
        const now = performance.now();
        if (now - lastFlush >= 60) {
          lastFlush = now;
          setStreamingLyrics([...accumulated], sourceLanguage);
        }
      };

      const handle = (obj: any) => {
        switch (obj.type) {
          case 'meta':
            sourceLanguage = obj.sourceLanguage || sourceLanguage;
            break;
          case 'line':
            accumulated.push(obj.line);
            flush();
            break;
          case 'full':
            setTranslatedLyrics(obj.lyrics, obj.hash, obj.sourceLanguage);
            void putCachedTranslation({
              artist: track.artist,
              title: track.title,
              lang,
              lyrics: obj.lyrics,
              sourceLanguage: obj.sourceLanguage,
              hash: obj.hash,
            });
            finalized = true;
            break;
          case 'done':
            hash = obj.hash || hash;
            sourceLanguage = obj.sourceLanguage || sourceLanguage;
            break;
          case 'error':
            serverError = obj.error || 'Something went wrong translating this song.';
            serverErrorCode = obj.code ?? null;
            break;
        }
      };

      streamLoop: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const raw = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!raw) continue;
          handle(JSON.parse(raw));
          if (serverError || finalized) break streamLoop;
        }
      }
      const tail = buffer.trim();
      if (tail && !serverError && !finalized) handle(JSON.parse(tail));

      if (serverError) {
        setTranslationError(serverError, serverErrorCode);
        setTranslating(false);
        return;
      }

      if (finalized) return; // 'full' (cache hit) already set final state

      if (accumulated.length > 0) {
        setTranslatedLyrics(accumulated, hash, sourceLanguage);
        void putCachedTranslation({
          artist: track.artist,
          title: track.title,
          lang,
          lyrics: accumulated,
          sourceLanguage,
          hash,
        });
      } else {
        setTranslationError('Something went wrong translating this song.');
        setTranslating(false);
      }
    } catch (error) {
      // A superseded request was aborted on purpose — stay silent.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setTranslationError('Network error — check your connection and try again.');
      setLoading(false);
      setTranslating(false);
    }
  }, [playback, preferences.targetLanguage, setTranslatedLyrics, setStreamingLyrics, setLoading, setTranslating, setTranslationError]);

  const dismissError = useCallback(() => {
    setTranslationError(null);
  }, [setTranslationError]);

  const flagTranslation = useCallback(async () => {
    try {
      const storedHash = localStorage.getItem('melofy-current-hash');
      if (storedHash) {
        await fetch('/api/translation/flag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hash: storedHash }),
        });
      }
      // Drop the client copy so the next play re-fetches a fresh translation.
      const track = playback.track;
      if (track) await deleteCachedTranslation(track.artist, track.title, preferences.targetLanguage);
    } catch (error) {
      console.error('[Melofy] Flag error:', error);
    }
  }, [playback, preferences.targetLanguage]);

  return { fetchTranslation, flagTranslation, dismissError };
}

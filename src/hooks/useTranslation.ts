'use client';

import { useCallback } from 'react';
import { useMelofy } from './useMelofy';

export function useTranslation() {
  const {
    playback,
    preferences,
    setTranslatedLyrics,
    setLoading,
    setTranslating,
    setTranslationError,
    clearLyrics,
  } = useMelofy();

  const fetchTranslation = useCallback(async () => {
    const { track } = playback;
    if (!track) return;

    setTranslationError(null);
    setLoading(true);

    try {
      const lyricsRes = await fetch(
        `/api/lyrics/search?artist=${encodeURIComponent(track.artist)}&title=${encodeURIComponent(track.title)}`
      );

      if (!lyricsRes.ok) {
        setTranslationError('No lyrics found for this track.');
        setLoading(false);
        return;
      }

      const { lyrics } = await lyricsRes.json();
      if (!lyrics || lyrics.length === 0) {
        setTranslationError('No lyrics found for this track.');
        setLoading(false);
        return;
      }

      setLoading(false);
      setTranslating(true);

      const translateRes = await fetch('/api/translation/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: track.artist,
          title: track.title,
          targetLanguage: preferences.targetLanguage,
        }),
      });

      if (!translateRes.ok) {
        const err = await translateRes.json().catch(() => ({ error: 'Translation failed' }));
        setTranslationError(err.error || 'Translation failed. Ensure your OpenAI API key is set.');
        setTranslating(false);
        return;
      }

      const data = await translateRes.json();
      setTranslatedLyrics(data.lyrics, data.hash, data.sourceLanguage);
    } catch (error) {
      setTranslationError('Network error. Is the server running?');
      setLoading(false);
      setTranslating(false);
    }
  }, [playback, preferences.targetLanguage, setTranslatedLyrics, setLoading, setTranslating, setTranslationError]);

  const dismissError = useCallback(() => {
    setTranslationError(null);
  }, [setTranslationError]);

  const flagTranslation = useCallback(async () => {
    try {
      const storedHash = localStorage.getItem('melofy-current-hash');
      if (!storedHash) return;

      await fetch('/api/translation/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: storedHash }),
      });
    } catch (error) {
      console.error('[Melofy] Flag error:', error);
    }
  }, []);

  return { fetchTranslation, flagTranslation, dismissError };
}

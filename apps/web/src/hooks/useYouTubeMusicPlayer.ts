'use client';

import { useEffect, useState } from 'react';
import { useMelofy } from './useMelofy';
import type { NowPlaying } from '@/lib/types';

/**
 * Receives YouTube Music now-playing from the Melofy browser extension.
 *
 * The extension injects a bridge content script on this origin that posts the
 * current track via window.postMessage (see apps/extension). We listen for it,
 * mark the extension as detected, and feed `playback` — the same shape the
 * Spotify poller produces — so the rest of the app (cards, /playing) is agnostic
 * to the source. Returns `extensionDetected` so the UI can prompt to install it.
 */
export function useYouTubeMusicPlayer() {
  const { setSourcePlayback } = useMelofy();
  const [extensionDetected, setExtensionDetected] = useState(false);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window) return;
      const data = e.data as { source?: string; type?: string; nowPlaying?: NowPlaying } | undefined;
      if (data?.source !== 'melofy-extension') return;

      setExtensionDetected(true);

      if (data.type === 'NOW_PLAYING' && data.nowPlaying) {
        const np = data.nowPlaying;
        setSourcePlayback('youtube_music', {
          connected: true,
          isPlaying: np.isPlaying,
          positionMs: np.positionMs,
          track: np.track,
        });
      }
    };

    window.addEventListener('message', onMessage);
    // The bridge may have sent READY before we mounted — ask for current state.
    window.postMessage({ source: 'melofy-web', type: 'REQUEST_NOW_PLAYING' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, [setSourcePlayback]);

  return { extensionDetected };
}

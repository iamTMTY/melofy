'use client';

import { useEffect, useState } from 'react';
import { useMelofy } from './useMelofy';
import type { NowPlaying } from '@/lib/types';

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
    window.postMessage({ source: 'melofy-web', type: 'REQUEST_NOW_PLAYING' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, [setSourcePlayback]);

  return { extensionDetected };
}

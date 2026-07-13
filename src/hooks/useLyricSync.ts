'use client';

import { useEffect, useRef } from 'react';
import { useMelofy } from './useMelofy';
import type { LyricLine } from '@/lib/types';

export function useLyricSync(lyrics: LyricLine[]) {
  const { playback, setActiveLineIndex, activeLineIndex } = useMelofy();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(-1);

  // Continuous rAF scroll loop
  useEffect(() => {
    if (lyrics.length === 0) return;

    let raf: number;

    const tick = () => {
      const pos = playback.positionMs;

      // Find current line
      let idx = -1;
      for (let i = lyrics.length - 1; i >= 0; i--) {
        if (pos >= lyrics[i].timeMs) {
          idx = i;
          break;
        }
      }

      if (idx !== activeIndexRef.current) {
        activeIndexRef.current = idx;
        setActiveLineIndex(idx);
      }

      // Scroll: center the active line if it's past the midpoint
      if (idx >= 0 && containerRef.current) {
        const lines = containerRef.current.querySelectorAll<HTMLElement>('.lyric-line');
        const line = lines[idx];
        if (line) {
          const ch = containerRef.current.clientHeight;
          const lt = line.offsetTop;
          const lh = line.offsetHeight;

          if (lt > ch / 2) {
            // Past midpoint — keep centered
            const target = lt - ch / 2 + lh / 2;
            containerRef.current.scrollTop += (target - containerRef.current.scrollTop) * 0.3;
          }
          // Before midpoint — natural scroll from top, no forced centering
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lyrics, playback.positionMs, setActiveLineIndex]);

  return { containerRef, activeLineIndex };
}

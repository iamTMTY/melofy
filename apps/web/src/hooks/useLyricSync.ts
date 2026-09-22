'use client';

import { useEffect, useRef } from 'react';
import { useMelofy } from './useMelofy';
import type { LyricLine } from '@/lib/types';

// Lead the active-line highlight so it lands ON the beat rather than a moment
// after you hear the line — matches the extension's clock. Tunable.
const SYNC_LOOKAHEAD_MS = 200;

export function useLyricSync(lyrics: LyricLine[]) {
  const { playback, setActiveLineIndex, activeLineIndex } = useMelofy();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(-1);

  const clockRef = useRef({ pos: 0, at: 0, playing: false });
  useEffect(() => {
    clockRef.current = {
      pos: playback.positionMs,
      at: performance.now(),
      playing: playback.isPlaying,
    };
  }, [playback.positionMs, playback.isPlaying]);

  useEffect(() => {
    if (lyrics.length === 0) return;

    activeIndexRef.current = -1;
    let raf = 0;

    const tick = () => {
      const { pos, at, playing } = clockRef.current;
      const estimated = playing
        ? pos + Math.min(performance.now() - at, 2000) + SYNC_LOOKAHEAD_MS
        : pos;

      let idx = -1;
      for (let i = lyrics.length - 1; i >= 0; i--) {
        if (estimated >= lyrics[i].timeMs) {
          idx = i;
          break;
        }
      }

      if (idx !== activeIndexRef.current) {
        activeIndexRef.current = idx;
        setActiveLineIndex(idx);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lyrics, setActiveLineIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || activeLineIndex < 0) return;

    const lines = container.querySelectorAll<HTMLElement>('.lyric-line');
    const line = lines[activeLineIndex];
    if (!line) return;

    const target =
      line.offsetTop - container.clientHeight / 2 + line.offsetHeight / 2;

    container.scrollTo({
      top: Math.max(0, target),
      behavior: 'smooth',
    });
  }, [activeLineIndex]);

  return { containerRef, activeLineIndex };
}

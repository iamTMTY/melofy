'use client';

import { useEffect, useRef } from 'react';
import { useMelofy } from './useMelofy';
import type { LyricLine } from '@/lib/types';

export function useLyricSync(lyrics: LyricLine[]) {
  const { playback, setActiveLineIndex, activeLineIndex } = useMelofy();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(-1);

  // Playback position only refreshes every ~500ms, so we keep the last known
  // position plus the timestamp it arrived and interpolate between updates.
  // This keeps the active-line detection smooth instead of stepping.
  const clockRef = useRef({ pos: 0, at: 0, playing: false });
  useEffect(() => {
    clockRef.current = {
      pos: playback.positionMs,
      at: performance.now(),
      playing: playback.isPlaying,
    };
  }, [playback.positionMs, playback.isPlaying]);

  // Single RAF loop (set up once per lyric set) that resolves the active line
  // from the interpolated position and pushes it into shared state.
  useEffect(() => {
    if (lyrics.length === 0) return;

    activeIndexRef.current = -1;
    let raf = 0;

    const tick = () => {
      const { pos, at, playing } = clockRef.current;
      const estimated = playing ? pos + (performance.now() - at) : pos;

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

  // Keep the active line centered in the scroll container — the Spotify /
  // Apple Music behavior. Runs only when the active line actually changes.
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

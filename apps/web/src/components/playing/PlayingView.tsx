'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useMelofy } from '@/hooks/useMelofy';
import type { MusicService } from '@/lib/types';
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer';
import { useYouTubeMusicPlayer } from '@/hooks/useYouTubeMusicPlayer';
import { useTranslation } from '@/hooks/useTranslation';
import { useLyricSync } from '@/hooks/useLyricSync';
import { AlbumArtBackground } from '@/components/shared/AlbumArtBackground';
import { useAdaptiveAccent } from '@/hooks/useAdaptiveAccent';
import { presetConfig, readingLayout } from '@/lib/theme';
import { LyricShareModal } from './LyricShareModal';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { MAX_SHARE_LINES, toggleShareSelection, type ShareLine } from '@/lib/shareCard';
import { LoadingCycler } from './LoadingCycler';
import { ByokButton } from '@/components/shared/ByokButton';
import { NowPlayingBar } from './NowPlayingBar';

const FONT_SIZE_MAP: Record<string, string> = {
  small: 'text-2xl',
  medium: 'text-3xl',
  large: 'text-4xl',
};

const FONT_SIZE_MAP_INACTIVE: Record<string, string> = {
  small: 'text-lg',
  medium: 'text-xl',
  large: 'text-2xl',
};

export function PlayingView() {
  const {
    sources,
    activeSource,
    setActiveSource,
    playback,
    preferences,
    translatedLyrics,
    isLoadingLyrics,
    isTranslating,
    translationError,
    translationErrorCode,
    activeLineIndex,
    clearLyrics,
  } = useMelofy();
  const { fetchTranslation, dismissError } = useTranslation();
  const { containerRef } = useLyricSync(translatedLyrics);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const lastFetchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('melofy-spotify-access-token');
    const expiresAt = localStorage.getItem('melofy-spotify-expires-at');
    if (token && expiresAt && Date.now() < parseInt(expiresAt, 10)) {
      setSpotifyToken(token);
    }
  }, []);

  useSpotifyPlayer(spotifyToken);
  useYouTubeMusicPlayer();

  useEffect(() => {
    if (activeSource) return;
    const order: MusicService[] = ['spotify', 'youtube_music', 'apple_music'];
    const connected = order.filter((s) => sources[s]?.connected);
    const best = connected.find((s) => sources[s]?.track) ?? connected[0];
    if (best) setActiveSource(best);
  }, [sources, activeSource, setActiveSource]);

  useEffect(() => {
    const track = playback.track;
    if (!track) return;

    const key = [
      track.artist,
      track.title,
      track.album ?? '',
      track.durationMs ?? '',
      preferences.targetLanguage,
    ].join('|||');
    if (lastFetchKeyRef.current === key) return;
    lastFetchKeyRef.current = key;

    clearLyrics();
    setSelected([]);
    fetchTranslation();
  }, [
    // Every field the key is built from must be here. It re-runs today anyway
    // because `fetchTranslation` changes identity with `playback`, but that is
    // incidental — narrowing that hook's deps would silently break refetching.
    playback.track?.artist,
    playback.track?.title,
    playback.track?.album,
    playback.track?.durationMs,
    preferences.targetLanguage,
    fetchTranslation,
    clearLyrics,
  ]);

  const track = playback.track;
  const hasLyrics = translatedLyrics.length > 0;
  const isLoading = isLoadingLyrics || isTranslating;
  const loadState = isLoadingLyrics ? 'fetching' : isTranslating ? 'translating' : null;
  const showOriginal = preferences.showOriginalLyrics;
  const fs = preferences.fontSize || 'medium';
  const activeSize = FONT_SIZE_MAP[fs] || 'text-3xl';
  const inactiveSize = FONT_SIZE_MAP_INACTIVE[fs] || 'text-xl';
  const albumArt = track?.albumArtUrl;

  const preset = presetConfig(preferences.themePreset);
  const layout = readingLayout(preferences.readingPriority);
  const accent = useAdaptiveAccent(albumArt, preset.adaptiveAccent);
  const alignClass = preset.align === 'left' ? 'text-left' : 'text-center';

  const partsFor = (lyric: (typeof translatedLyrics)[number]): ShareLine => {
    const primary = layout.lead === 'original' ? lyric.original : lyric.translated || lyric.original;
    const secondaryRaw = layout.lead === 'original' ? lyric.translated : lyric.original;
    const show = !!secondaryRaw && secondaryRaw !== primary && (layout.lead === 'original' || showOriginal);
    return { primary, secondary: show ? secondaryRaw : null };
  };

  const toggleLine = (idx: number) => setSelected((cur) => toggleShareSelection(cur, idx));

  useEscapeKey(selected.length > 0 && !shareOpen, () => {
    setSelected([]);
    // Clearing the selection doesn't drop DOM focus, and a focused lyric keeps
    // the UA focus ring on screen — which reads as "Escape did nothing".
    (document.activeElement as HTMLElement | null)?.blur();
  });

  const [selectionBox, setSelectionBox] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container || selected.length === 0) {
      setSelectionBox(null);
      return;
    }
    const measure = () => {
      const nodes = container.querySelectorAll<HTMLElement>('.lyric-line');
      const first = nodes[selected[0]];
      const last = nodes[selected[selected.length - 1]];
      if (!first || !last) return;
      setSelectionBox({
        top: first.offsetTop,
        height: last.offsetTop + last.offsetHeight - first.offsetTop,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [selected, translatedLyrics, fs, preset.density, showOriginal, layout.lead, containerRef]);

  const shareLines = useMemo(
    () => selected.filter((i) => translatedLyrics[i]).map((i) => partsFor(translatedLyrics[i])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, translatedLyrics, layout.lead, showOriginal]
  );

  return (
    <AlbumArtBackground imageUrl={albumArt} fixed variant={preset.background}>
      <div className="flex flex-1 flex-col min-h-0">
        <NowPlayingBar />

        {translationError && (
          <div className="flex-shrink-0 mx-auto max-w-3xl w-full px-6 pt-4">
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4"
            >
              <div className="flex items-start gap-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 flex-shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">{translationError}</p>
                  {translationErrorCode === 'RATE_LIMIT' && (
                    <p className="mt-1 text-xs text-amber-500/80">
                      <ByokButton
                        label="Use your own API key"
                        className="font-semibold underline decoration-amber-500/40 underline-offset-2 hover:text-amber-500"
                        onSaved={fetchTranslation}
                      />{' '}
                      to keep translating.
                    </p>
                  )}
                </div>
                <button onClick={dismissError} className="text-amber-400 hover:text-amber-500">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {track && loadState && !hasLyrics && (
          <div className="flex flex-1 items-center justify-center">
            <LoadingCycler state={loadState} />
          </div>
        )}

        {!track && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-melofy-500/10 mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-melofy-500">
                <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Nothing Playing</h2>
            <p className="mt-2 text-base text-gray-500 dark:text-white/40 max-w-xs">
              Play a song on Spotify and it will appear here.
            </p>
          </div>
        )}

        {hasLyrics && (
          <div
            ref={containerRef}
            className="relative flex-1 min-h-0 overflow-y-auto hide-scrollbar"
            style={{
              scrollbarWidth: 'none' as any,
              WebkitOverflowScrolling: 'touch',
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)',
            }}
          >
            <div className={`relative py-[42vh] ${preset.align === 'left' ? 'mx-auto w-full max-w-3xl' : ''}`}>
              {selectionBox && (
                <motion.div
                  aria-hidden
                  initial={false}
                  animate={{ top: selectionBox.top, height: selectionBox.height }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                  className="pointer-events-none absolute inset-x-0 rounded-2xl bg-white/10 ring-1 ring-white/25"
                />
              )}
              {translatedLyrics.map((lyric, idx) => {
                const isActive = idx === activeLineIndex;
                const isPast = idx < activeLineIndex;

                const { primary, secondary: secondaryRaw } = partsFor(lyric);
                const showSecondary = !!secondaryRaw;
                const isSelected = selected.includes(idx);

                return (
                  <motion.div
                    key={lyric.index}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => toggleLine(idx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleLine(idx);
                      }
                    }}
                    animate={{
                      opacity:
                        isActive || isSelected
                          ? 1
                          : preset.focusBlur
                            ? isPast ? 0.6 : 0.45
                            : isPast ? 0.55 : 0.2,
                      filter: preset.focusBlur && !isActive && !isSelected ? 'blur(1.6px)' : 'blur(0px)',
                    }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                    className={`lyric-line relative cursor-pointer rounded-2xl px-8 outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                      preset.density === 'compact' ? 'py-3' : 'py-5'
                    }`}
                  >
                    <p
                      className={`${alignClass} font-bold leading-snug transition-all duration-400 ${
                        isActive
                          ? `${activeSize} text-gray-900 dark:text-white ${preset.align === 'left' ? '' : 'scale-105'}`
                          : `${inactiveSize} text-gray-900/55 dark:text-white/55`
                      }`}
                      style={
                        isActive && preset.adaptiveAccent
                          ? { color: accent, textShadow: '0 1px 12px rgba(0, 0, 0, 0.55)' }
                          : undefined
                      }
                    >
                      {primary}
                    </p>

                    {showSecondary && (
                      <p
                        className={`${alignClass} leading-snug mt-1.5 transition-all duration-400 ${
                          layout.equal
                            ? `font-bold ${isActive ? `${inactiveSize} text-gray-900/80 dark:text-white/80` : 'text-base text-gray-900/40 dark:text-white/35'}`
                            : isActive
                              ? 'text-base text-gray-500 dark:text-white/50'
                              : 'text-sm text-gray-400/40 dark:text-white/20'
                        }`}
                      >
                        {secondaryRaw}
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {selected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center px-6"
          >
            <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/70 p-1 pl-4 text-white shadow-xl backdrop-blur-xl">
              <span className="text-xs font-medium text-white/70">
                {selected.length} of {MAX_SHARE_LINES} lines
              </span>
              <button
                onClick={() => setShareOpen(true)}
                className="ml-2 rounded-full bg-melofy-500 px-4 py-2 text-sm font-semibold active:scale-[0.97] transition-transform duration-150"
              >
                Share
              </button>
              <button
                onClick={() => setSelected([])}
                aria-label="Clear selection"
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:text-white"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {shareOpen && track && (
        <LyricShareModal
          lines={shareLines}
          title={track.title}
          artist={track.artist}
          albumArtUrl={albumArt}
          accent={preset.adaptiveAccent ? accent : undefined}
          onClose={() => {
            setShareOpen(false);
            setSelected([]);
          }}
        />
      )}
    </AlbumArtBackground>
  );
}

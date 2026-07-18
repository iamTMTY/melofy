'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { MelofyProvider, useMelofy } from '@/hooks/useMelofy';
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer';
import { useTranslation } from '@/hooks/useTranslation';
import { useLyricSync } from '@/hooks/useLyricSync';
import { AlbumArtBackground } from '@/components/shared/AlbumArtBackground';

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

function NowPlayingBar() {
  const { playback, preferences, setPreferences } = useMelofy();
  const track = playback.track;
  if (!track) return null;

  const progress =
    track.durationMs > 0
      ? Math.min(100, Math.max(0, (playback.positionMs / track.durationMs) * 100))
      : 0;

  return (
    <header className="relative z-40 flex-shrink-0 glass-surface-heavy border-b border-black/[0.06] dark:border-white/[0.06]">
      <div className="mx-auto flex max-w-3xl items-center gap-3.5 px-4 py-3 sm:px-6">
        {/* Artwork */}
        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl shadow-md ring-1 ring-black/5 dark:ring-white/10">
          {track.albumArtUrl ? (
            <Image src={track.albumArtUrl} alt={track.album} fill sizes="48px" className="object-cover" priority />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-melofy-500/40 to-melofy-800/60" />
          )}
          {playback.isPlaying && (
            <span className="absolute inset-x-0 bottom-0 flex h-4 items-end justify-center gap-[2px] bg-gradient-to-t from-black/50 to-transparent pb-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-[2px] rounded-full bg-white"
                  animate={{ height: ['25%', '95%', '25%'] }}
                  transition={{ repeat: Infinity, duration: 0.85, delay: i * 0.16, ease: 'easeInOut' }}
                  style={{ height: '25%' }}
                />
              ))}
            </span>
          )}
        </div>

        {/* Meta */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em] text-gray-900 dark:text-white">
            {track.title}
          </h1>
          <p className="mt-0.5 truncate text-[13px] leading-tight text-gray-500 dark:text-white/45">
            {track.artist}
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={() => setPreferences({ showOriginalLyrics: !preferences.showOriginalLyrics })}
            aria-pressed={preferences.showOriginalLyrics}
            className={`pressable rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors duration-200 ${
              preferences.showOriginalLyrics
                ? 'bg-melofy-500 text-white shadow-sm shadow-melofy-500/30'
                : 'bg-black/[0.05] text-gray-500 dark:bg-white/[0.08] dark:text-white/50'
            }`}
          >
            Original
          </button>

          {/* Font size — segmented control */}
          <div className="flex items-center rounded-full bg-black/[0.05] p-0.5 dark:bg-white/[0.08]">
            {(['small', 'medium', 'large'] as const).map((size) => (
              <button
                key={size}
                onClick={() => setPreferences({ fontSize: size })}
                aria-label={`Font size ${size}`}
                aria-pressed={preferences.fontSize === size}
                className={`pressable h-7 w-7 rounded-full text-[12px] font-semibold transition-all duration-200 ${
                  preferences.fontSize === size
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-white dark:text-gray-900'
                    : 'text-gray-400 dark:text-white/40'
                }`}
              >
                {size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Playback progress */}
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/[0.06] dark:bg-white/[0.06]">
        <div
          className="h-full bg-melofy-500 transition-[width] duration-500 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </header>
  );
}

function PlayingPage() {
  const { playback, preferences, translatedLyrics, isTranslating, translationError, activeLineIndex } = useMelofy();
  const { fetchTranslation, dismissError } = useTranslation();
  const { containerRef } = useLyricSync(translatedLyrics);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    const token = localStorage.getItem('melofy-spotify-access-token');
    const expiresAt = localStorage.getItem('melofy-spotify-expires-at');
    if (token && expiresAt && Date.now() < parseInt(expiresAt, 10)) {
      setSpotifyToken(token);
    }
  }, []);

  useSpotifyPlayer(spotifyToken);

  useEffect(() => {
    if (playback.track && !hasFetchedRef.current && translatedLyrics.length === 0) {
      hasFetchedRef.current = true;
      fetchTranslation();
    }
  }, [playback.track?.title, fetchTranslation, translatedLyrics.length]);

  useEffect(() => {
    hasFetchedRef.current = false;
  }, [playback.track?.title]);

  const track = playback.track;
  const hasLyrics = translatedLyrics.length > 0;
  const showOriginal = preferences.showOriginalLyrics;
  const fs = preferences.fontSize || 'medium';
  const activeSize = FONT_SIZE_MAP[fs] || 'text-3xl';
  const inactiveSize = FONT_SIZE_MAP_INACTIVE[fs] || 'text-xl';
  const albumArt = track?.albumArtUrl;

  return (
    <AlbumArtBackground imageUrl={albumArt} fixed>
      <div className="flex flex-1 flex-col min-h-0">
        <NowPlayingBar />

        {/* Error */}
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
                  <p className="text-xs text-amber-500/70 mt-1">Not all songs are available in the lyrics database yet. Try a popular track.</p>
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

        {/* Loading skeleton */}
        {isTranslating && !hasLyrics && (
          <div className="flex-shrink-0 mx-auto max-w-3xl w-full px-6 pt-8">
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.1 }}
                  className="h-5 rounded-full bg-gray-100 dark:bg-white/5"
                  style={{ width: `${40 + Math.random() * 50}%` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* No track */}
        {!track && !isTranslating && (
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

        {/* Lyrics */}
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
            <div className="py-[42vh]">
              {translatedLyrics.map((lyric, idx) => {
                const isActive = idx === activeLineIndex;
                const isPast = idx < activeLineIndex;

                return (
                  <motion.div
                    key={lyric.index}
                    animate={{
                      opacity: isActive ? 1 : isPast ? 0.55 : 0.2,
                    }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                    className="lyric-line px-8 py-5"
                  >
                    <p className={`text-center font-bold leading-snug transition-all duration-400 ${
                      isActive
                        ? `${activeSize} text-gray-900 dark:text-white scale-105`
                        : `${inactiveSize} text-gray-900/55 dark:text-white/55`
                    }`}>
                      {lyric.translated || lyric.original}
                    </p>

                    {showOriginal && lyric.translated && lyric.translated !== lyric.original && (
                      <p className={`text-center leading-snug mt-1.5 transition-all duration-400 ${
                        isActive
                          ? 'text-base text-gray-500 dark:text-white/50'
                          : 'text-sm text-gray-400/40 dark:text-white/20'
                      }`}>
                        {lyric.original}
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AlbumArtBackground>
  );
}

export default function PlayingPageWrapper() {
  return (
    <MelofyProvider>
      <PlayingPage />
    </MelofyProvider>
  );
}

'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { MelofyProvider, useMelofy } from '@/hooks/useMelofy';
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer';
import { useTranslation } from '@/hooks/useTranslation';
import { useLyricSync } from '@/hooks/useLyricSync';
import Link from 'next/link';

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

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

function SpotifyPage() {
  const { playback, preferences, translatedLyrics, isTranslating, isLoadingLyrics, translationError, activeLineIndex } = useMelofy();
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
  const progress = track ? (playback.positionMs / (track.durationMs || 1)) * 100 : 0;

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0b] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 sticky top-0 z-50 border-b border-gray-100 dark:border-white/5 bg-white/80 dark:bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3 pressable">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="text-sm font-medium text-gray-500 dark:text-white/40">Dashboard</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-[#1DB954]/10 px-3 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-[#1DB954] animate-pulse" />
              <span className="text-xs font-medium text-[#1DB954]">Spotify</span>
            </div>
          </div>
        </div>
      </header>

      {/* Now Playing card — sticky at top */}
      {track && (
        <div className="flex-shrink-0 sticky top-14 z-30 bg-white/90 dark:bg-[#0a0a0b]/90 backdrop-blur-xl border-b border-gray-100 dark:border-white/5 mx-auto w-full px-6 py-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 max-w-3xl mx-auto"
          >
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl shadow-lg">
              {track.albumArtUrl ? (
                <Image src={track.albumArtUrl} alt={track.album} fill className="object-cover" priority />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-melofy-500/40 to-melofy-800/60" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-full bg-[#1DB954]/10 px-2 py-0.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#1DB954]" />
                  <span className="text-[10px] font-semibold text-[#1DB954]">SPOTIFY</span>
                </div>
              </div>
              <h1 className="text-base font-bold tracking-tight text-gray-900 dark:text-white truncate mt-1">
                {track.title}
              </h1>
              <p className="text-sm text-gray-500 dark:text-white/40 truncate">
                {track.artist}
              </p>
            </div>
            <div className="text-right flex-shrink-0 text-xs text-gray-400 dark:text-white/20 tabular-nums">
              {formatTime(playback.positionMs)}
            </div>
          </motion.div>
        </div>
      )}

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
          className="flex-1 overflow-y-auto hide-scrollbar"
          style={{ scrollBehavior: 'smooth' }}
        >
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
      )}

      {hasLyrics && <LyricBottomBar />}
    </div>
  );
}

function LyricBottomBar() {
  const { preferences, setPreferences } = useMelofy();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-shrink-0 px-4 pb-6 pt-2"
    >
      <div className="glass-surface mx-auto flex max-w-md items-center justify-between rounded-2xl px-4 py-2.5 border border-white/20 dark:border-white/10">
        <button
          onClick={() => setPreferences({ showOriginalLyrics: !preferences.showOriginalLyrics })}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-all duration-200 pressable ${
            preferences.showOriginalLyrics ? 'bg-melofy-500/20 text-melofy-400' : 'text-gray-400 dark:text-white/30'
          }`}
        >
          <span>Original</span>
          <div className={`h-3.5 w-7 rounded-full transition-colors duration-200 ${
            preferences.showOriginalLyrics ? 'bg-melofy-500' : 'bg-gray-200 dark:bg-white/10'
          }`}>
            <motion.div
              animate={{ x: preferences.showOriginalLyrics ? 14 : 0 }}
              transition={{ type: 'spring', bounce: 0.3, duration: 0.3 }}
              className="h-3.5 w-3.5 rounded-full bg-white shadow-sm"
            />
          </div>
        </button>

        <div className="flex items-center gap-0.5">
          {(['small', 'medium', 'large'] as const).map((size) => (
            <button
              key={size}
              onClick={() => setPreferences({ fontSize: size })}
              className={`rounded-lg px-2.5 py-1 text-sm font-semibold transition-all duration-200 pressable ${
                preferences.fontSize === size
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                  : 'text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60'
              }`}
            >
              {size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}
            </button>
          ))}
        </div>

        <button className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-medium text-gray-400 dark:text-white/20 transition-colors pressable">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
          </svg>
          Flag
        </button>
      </div>
    </motion.div>
  );
}

export default function SpotifyPageWrapper() {
  return (
    <MelofyProvider>
      <SpotifyPage />
    </MelofyProvider>
  );
}

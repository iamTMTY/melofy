'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useMelofy } from '@/hooks/useMelofy';
import type { MusicService } from '@/lib/types';
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer';
import { useYouTubeMusicPlayer } from '@/hooks/useYouTubeMusicPlayer';
import { useTranslation } from '@/hooks/useTranslation';
import { useLyricSync } from '@/hooks/useLyricSync';
import { AlbumArtBackground } from '@/components/shared/AlbumArtBackground';
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
  const lastFetchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('melofy-spotify-access-token');
    const expiresAt = localStorage.getItem('melofy-spotify-expires-at');
    if (token && expiresAt && Date.now() < parseInt(expiresAt, 10)) {
      setSpotifyToken(token);
    }
  }, []);

  // Both providers run so BOTH platforms populate (needed for the source switcher);
  // the active source alone drives the lyrics below.
  useSpotifyPlayer(spotifyToken);
  useYouTubeMusicPlayer();

  // Direct load/refresh on /playing with no chosen source → default to a connected
  // one (preferring whichever is actually playing). A persisted choice is respected.
  useEffect(() => {
    if (activeSource) return;
    const order: MusicService[] = ['spotify', 'youtube_music', 'apple_music'];
    const connected = order.filter((s) => sources[s]?.connected);
    const best = connected.find((s) => sources[s]?.track) ?? connected[0];
    if (best) setActiveSource(best);
  }, [sources, activeSource, setActiveSource]);

  // Refetch whenever the song OR the target language changes. We clear the old
  // lyrics first so the skeleton takes over immediately — no stale lyrics linger
  // under the new track/language while the translation loads.
  useEffect(() => {
    const track = playback.track;
    if (!track) return;

    const key = `${track.artist}|||${track.title}|||${preferences.targetLanguage}`;
    if (lastFetchKeyRef.current === key) return;
    lastFetchKeyRef.current = key;

    clearLyrics();
    fetchTranslation();
  }, [
    playback.track?.artist,
    playback.track?.title,
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

        {/* Loading skeleton — mirrors the centered lyric layout */}
        {track && loadState && !hasLyrics && (
          <div className="flex flex-1 items-center justify-center">
            <LoadingCycler state={loadState} />
          </div>
        )}

        {/* No track */}
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

'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useMelofy } from '@/hooks/useMelofy';
import { useTranslation } from '@/hooks/useTranslation';

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function CurrentlyPlayingCard() {
  const { playback, preferences, isTranslating, translationError } = useMelofy();
  const { fetchTranslation, dismissError } = useTranslation();
  const track = playback.track;

  if (!track) return null;

  const progress = (playback.positionMs / (track.durationMs || 1)) * 100;
  const languageName = preferences.targetLanguage === 'en'
    ? 'English'
    : 'your language';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
      className="mx-auto w-full max-w-sm px-4"
    >
      {/* Album art with glass overlay */}
      <div className="relative mb-6 overflow-hidden rounded-3xl aspect-square shadow-2xl shadow-black/20">
        {track.albumArtUrl ? (
          <Image
            src={track.albumArtUrl}
            alt={track.album}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-melofy-500/40 to-melofy-800/60" />
        )}

        {/* Glass overlay at the bottom */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent p-6 pt-24">
          <div className="flex items-center gap-2">
            {/* Spotify badge */}
            <div className="flex items-center gap-1 rounded-full bg-[#1DB954]/90 backdrop-blur-sm px-2.5 py-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02z" />
              </svg>
              <span className="text-[11px] font-semibold text-white">Spotify</span>
            </div>

            {playback.isPlaying && (
              <div className="flex items-end gap-[1.5px] h-4">
                {[0.6, 1, 0.4, 0.8, 0.5].map((h, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: [2, h * 14, 2] }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.8 + i * 0.15,
                      ease: 'easeInOut',
                    }}
                    className="w-[3px] rounded-full bg-white/80"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Track info */}
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
          {track.title}
        </h2>
        <p className="text-sm text-gray-500 dark:text-white/50">
          {track.artist}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mt-4 mb-8">
        <div className="flex justify-between text-[11px] text-gray-400 dark:text-white/30 mb-1.5">
          <span>{formatTime(playback.positionMs)}</span>
          <span>{formatTime(track.durationMs)}</span>
        </div>
        <div className="h-1 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.25, ease: 'linear' }}
            className="h-full rounded-full bg-gradient-to-r from-melofy-400 to-melofy-500"
          />
        </div>
      </div>

      {/* Error state */}
      {translationError && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 p-4"
        >
          <div className="flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">{translationError}</p>
              <p className="text-xs text-red-500/70 mt-1">
                Try a popular song — most major tracks are available in the lyrics database.
              </p>
            </div>
            <button onClick={dismissError} className="text-red-400 hover:text-red-500 flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}

      {/* Translate CTA */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        whileHover={{ scale: 1.02 }}
        onClick={fetchTranslation}
        disabled={isTranslating}
        className="group relative w-full rounded-2xl bg-melofy-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-melofy-500/25 hover:bg-melofy-600 transition-colors duration-200 overflow-hidden"
      >
        {isTranslating ? (
          <span className="flex items-center justify-center gap-2">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
            />
            Translating...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 8l4-4 4 4" />
              <path d="M9 4v16" />
              <path d="M19 16l-4 4-4-4" />
              <path d="M15 20V4" />
            </svg>
            Translate to {languageName}
          </span>
        )}
      </motion.button>
    </motion.div>
  );
}

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useMelofy } from '@/hooks/useMelofy';
import { useTranslation } from '@/hooks/useTranslation';

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function MiniPlayer() {
  const { playback } = useMelofy();
  const { fetchTranslation } = useTranslation();
  const track = playback.track;

  const progress = track
    ? (playback.positionMs / (track.durationMs || 1)) * 100
    : 0;

  return (
    <AnimatePresence>
      {track && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{
            type: 'spring',
            bounce: 0,
            duration: 0.5,
          }}
          className="glass-surface-heavy absolute bottom-20 left-0 right-0 z-30 mx-4 overflow-hidden rounded-2xl border border-white/20 dark:border-white/10"
        >
          {/* Progress bar */}
          <div className="h-0.5 bg-white/10">
            <motion.div
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.25, ease: 'linear' }}
              className="h-full bg-melofy-500"
            />
          </div>

          <div className="flex items-center gap-3 p-3">
            {/* Album art */}
            {track.albumArtUrl && (
              <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg shadow-lg">
                <Image
                  src={track.albumArtUrl}
                  alt={track.album}
                  fill
                  className="object-cover"
                />
              </div>
            )}

            {/* Track info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">
                {track.title}
              </p>
              <p className="text-xs text-gray-500 dark:text-white/50 truncate">
                {track.artist}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-white/30 mt-0.5">
                {formatTime(playback.positionMs)} / {formatTime(track.durationMs)}
              </p>
            </div>

            {/* Translate button */}
            <button
              onClick={fetchTranslation}
              className="flex items-center gap-1.5 rounded-xl bg-melofy-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-melofy-500/30 hover:bg-melofy-600 active:scale-95 transition-all duration-150"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 8l4-4 4 4" />
                <path d="M9 4v16" />
                <path d="M19 16l-4 4-4-4" />
                <path d="M15 20V4" />
              </svg>
              Translate
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

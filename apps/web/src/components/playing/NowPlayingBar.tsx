'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useMelofy } from '@/hooks/useMelofy';
import { DEFAULT_COVER } from '@/lib/platform';
import { LanguagePicker } from '@/components/shared/LanguagePicker';
import { SourceSwitcher } from './SourceSwitcher';
import { PlayerSettingsModal } from './PlayerSettingsModal';

export function NowPlayingBar() {
  const { playback, preferences, setPreferences } = useMelofy();
  const [settingsOpen, setSettingsOpen] = useState(false);
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
          <Image
            src={track.albumArtUrl || DEFAULT_COVER}
            alt={track.album}
            fill
            sizes="48px"
            className="object-cover"
            priority
          />
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

        {/* Controls — inline on desktop */}
        <div className="hidden flex-shrink-0 items-center gap-2 sm:flex">
          <SourceSwitcher />
          <LanguagePicker compact />

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

        {/* Controls — settings gear on mobile */}
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Lyrics settings"
          className="pressable flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-gray-600 transition-colors duration-200 hover:bg-black/[0.08] dark:bg-white/[0.08] dark:text-white/60 sm:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Playback progress */}
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/[0.06] dark:bg-white/[0.06]">
        <div
          className="h-full bg-melofy-500 transition-[width] duration-500 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <AnimatePresence>
        {settingsOpen && <PlayerSettingsModal onClose={() => setSettingsOpen(false)} />}
      </AnimatePresence>
    </header>
  );
}

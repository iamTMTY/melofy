'use client';

import { motion } from 'framer-motion';
import { useMelofy } from '@/hooks/useMelofy';
import { useTranslation } from '@/hooks/useTranslation';

export function LyricControls() {
  const { preferences, setPreferences, playback, translationHash } = useMelofy();
  const { flagTranslation } = useTranslation();

  const hasTrack = !!playback.track;

  if (!hasTrack) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        bounce: 0,
        duration: 0.4,
        delay: 0.6,
      }}
      className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-6"
    >
      <div className="glass-surface mx-auto flex max-w-md items-center justify-between rounded-2xl px-4 py-2.5">
        {/* Show original toggle */}
        <button
          onClick={() =>
            setPreferences({ showOriginalLyrics: !preferences.showOriginalLyrics })
          }
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200 pressable ${
            preferences.showOriginalLyrics
              ? 'bg-melofy-500/20 text-melofy-400'
              : 'text-white/50 hover:text-white/80'
          }`}
        >
          <span>Original</span>
          <div
            className={`h-3.5 w-7 rounded-full transition-colors duration-200 ${
              preferences.showOriginalLyrics ? 'bg-melofy-500' : 'bg-white/20'
            }`}
          >
            <motion.div
              animate={{ x: preferences.showOriginalLyrics ? 14 : 0 }}
              transition={{ type: 'spring', bounce: 0.3, duration: 0.3 }}
              className="h-3.5 w-3.5 rounded-full bg-white shadow-sm"
            />
          </div>
        </button>

        {/* Font size */}
        <div className="flex items-center gap-0.5">
          {(['small', 'medium', 'large'] as const).map((size) => {
            const isActive = preferences.fontSize === size;
            const sizeLabels = { small: 'A', medium: 'A', large: 'A' };
            const sizeClasses = { small: 'text-xs', medium: 'text-sm', large: 'text-base' };
            return (
              <button
                key={size}
                onClick={() => setPreferences({ fontSize: size })}
                className={`rounded-lg px-2 py-1 ${sizeClasses[size]} font-medium transition-all duration-200 pressable ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {sizeLabels[size]}
              </button>
            );
          })}
        </div>

        {/* Flag inaccurate translation */}
        {translationHash && (
          <button
            onClick={flagTranslation}
            className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-white/40 hover:text-white/70 transition-colors duration-200 pressable"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
            <span>Flag</span>
          </button>
        )}
      </div>
    </motion.div>
  );
}

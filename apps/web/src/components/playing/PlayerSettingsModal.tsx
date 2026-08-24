'use client';

import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useMelofy } from '@/hooks/useMelofy';
import { LanguagePicker } from '@/components/shared/LanguagePicker';
import { SourceSwitcher } from './SourceSwitcher';

// Consolidates the now-playing controls into one sheet — used on mobile where
// they don't fit in a row. Translucent material + spring, dismissed by tapping
// the scrim.
//
// Portaled to <body>: it's mounted from inside the now-playing bar, whose
// `backdrop-filter` would otherwise become the containing block for this
// position:fixed overlay (pinning it to the header instead of the viewport).
export function PlayerSettingsModal({ onClose }: { onClose: () => void }) {
  const { preferences, setPreferences } = useMelofy();

  if (typeof document === 'undefined') return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-2xl border border-black/[0.06] dark:border-white/10 shadow-2xl p-6 pb-8"
      >
        <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-black/10 dark:bg-white/15 sm:hidden" />
        <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white mb-5">Lyrics settings</h2>

        <div className="flex flex-col gap-5">
          {/* Language — compact (anchors right, in bounds) + dropUp (bottom sheet
              has no room below, so the list opens above the trigger) */}
          <Row label="Translate to">
            <LanguagePicker compact dropUp />
          </Row>

          {/* Source (renders nothing unless 2+ platforms connected) */}
          <Row label="Streaming source">
            <SourceSwitcher />
          </Row>

          {/* Show original */}
          <Row label="Show original lyrics">
            <button
              onClick={() => setPreferences({ showOriginalLyrics: !preferences.showOriginalLyrics })}
              aria-pressed={preferences.showOriginalLyrics}
              className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${
                preferences.showOriginalLyrics ? 'bg-melofy-500' : 'bg-black/10 dark:bg-white/15'
              }`}
            >
              <motion.span
                layout
                transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm ${
                  preferences.showOriginalLyrics ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
          </Row>

          {/* Font size */}
          <Row label="Text size">
            <div className="flex items-center rounded-full bg-black/[0.05] p-0.5 dark:bg-white/[0.08]">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setPreferences({ fontSize: size })}
                  aria-pressed={preferences.fontSize === size}
                  className={`h-8 w-9 rounded-full text-[13px] font-semibold transition-all duration-200 ${
                    preferences.fontSize === size
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-400 dark:text-white/40'
                  }`}
                >
                  {size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}
                </button>
              ))}
            </div>
          </Row>
        </div>

        <button
          onClick={onClose}
          className="mt-7 w-full rounded-2xl bg-melofy-500 px-4 py-3 text-sm font-semibold text-white active:scale-[0.98] transition-transform duration-150"
        >
          Done
        </button>
      </motion.div>
    </motion.div>,
    document.body
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-gray-600 dark:text-white/60">{label}</span>
      {children}
    </div>
  );
}

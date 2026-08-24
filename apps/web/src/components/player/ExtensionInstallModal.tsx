'use client';

import { motion } from 'framer-motion';

// Shown when the user picks YouTube Music but the Melofy browser extension —
// which provides YTM now-playing — isn't detected on this page.
export function ExtensionInstallModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#1c1c1e] p-8 text-center border border-gray-200 dark:border-white/10 shadow-2xl"
      >
        <div
          className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-5"
          style={{ backgroundColor: '#FF000015' }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#FF0000">
            <path d="M21.582 6.186a2.506 2.506 0 0 0-1.768-1.768C18.254 4 12 4 12 4s-6.254 0-7.814.418a2.506 2.506 0 0 0-1.768 1.768C2 7.746 2 12 2 12s0 4.254.418 5.814a2.506 2.506 0 0 0 1.768 1.768c1.56.42 7.814.418 7.814.418s6.254 0 7.814-.418a2.506 2.506 0 0 0 1.768-1.768C22 16.254 22 12 22 12s0-4.254-.418-5.814zM10 15.464V8.536L16 12l-6 3.464z" />
          </svg>
        </div>

        <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white mb-2">
          Melofy extension required
        </h2>
        <p className="text-sm text-gray-500 dark:text-white/50 mb-6 leading-relaxed">
          YouTube Music has no public API, so Melofy uses a small browser extension to read what
          you&rsquo;re playing and show synced, translated lyrics. Install it, then keep this tab open
          alongside YouTube Music.
        </p>

        <button
          onClick={onClose}
          className="w-full rounded-2xl bg-[#FF0000] px-4 py-3 text-sm font-semibold text-white hover:opacity-90 active:scale-[0.97] transition-all duration-200"
        >
          Got it
        </button>
        <p className="mt-3 text-xs text-gray-400 dark:text-white/30">Chrome Web Store listing coming soon.</p>
      </motion.div>
    </motion.div>
  );
}

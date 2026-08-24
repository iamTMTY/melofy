'use client';

import { motion } from 'framer-motion';

// Shown when someone taps Apple Music — which Melofy can't support without a paid
// Apple Developer account. Honest, and hopefully a little charming.
export function AppleMusicModal({ onClose }: { onClose: () => void }) {
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
        className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1c1c1e] p-8 text-center border border-gray-200 dark:border-white/10 shadow-2xl"
      >
        <div
          className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: '#FA233B15' }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#FA233B">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.429 16.286V7.714L17.143 5.57v13.858L10.571 16.28zM6.857 7.714v8.572c0 .473-.336.857-.75.857s-.75-.384-.75-.857V7.714c0-.473.336-.857.75-.857s.75.384.75.857z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white mb-2">
          Apple Music isn&rsquo;t here yet
        </h2>
        <p className="text-sm text-gray-500 dark:text-white/80 mb-6 leading-relaxed">
          I can&rsquo;t afford an Apple Developer account right now (that&rsquo;s $99/year 😅). If enough people ask for it, I&rsquo;ll happily reconsider — for now, Spotify
          and YouTube Music have you covered.
        </p>
        <button
          onClick={onClose}
          className="w-full rounded-2xl bg-[#FA233B] px-4 py-3 text-sm font-semibold text-white hover:opacity-90 active:scale-[0.97] transition-all duration-200"
        >
          Fair enough
        </button>
      </motion.div>
    </motion.div>
  );
}

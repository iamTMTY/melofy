'use client';

import { motion } from 'framer-motion';
import type { ServiceConfig } from './services';

export function PlaySongModal({ service, onClose }: { service: ServiceConfig; onClose: () => void }) {
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
          style={{ backgroundColor: `${service.color}15` }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={service.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>

        <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white mb-2">
          Connected to {service.name}
        </h2>
        <p className="text-gray-500 dark:text-white mb-6 leading-relaxed">
          Play a song on {service.name} — on your phone, desktop, or web player. It will appear here automatically.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-gray-200 dark:border-white/10 px-4 py-3 text-sm font-medium text-gray-700 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 active:scale-[0.97] transition-all duration-200"
          >
            Got it
          </button>
          <button
            onClick={() => { onClose(); window.open(service.openUrl, '_blank'); }}
            className="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white hover:opacity-90 active:scale-[0.97] transition-all duration-200"
            style={{ backgroundColor: service.color }}
          >
            Open {service.name}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useMelofy } from '@/hooks/useMelofy';

export function LoadingSkeleton() {
  const { isTranslating, isLoadingLyrics } = useMelofy();

  const isLoading = isLoadingLyrics || isTranslating;
  const message = isTranslating ? 'Translating lyrics...' : 'Loading lyrics...';

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6"
        >
          {/* Blurred background */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xl" />

          {/* Skeleton lines */}
          <div className="relative flex flex-col items-center gap-3 w-full max-w-md px-8">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: i * 0.1,
                  type: 'spring',
                  bounce: 0,
                  duration: 0.4,
                }}
                className="shimmer h-4 rounded-full bg-white/10"
                style={{ width: `${60 + Math.random() * 35}%` }}
              />
            ))}
          </div>

          {/* Spinner + text */}
          <div className="relative flex flex-col items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              className="h-8 w-8 rounded-full border-2 border-white/20 border-t-white"
            />
            <p className="text-sm font-medium text-white/70">{message}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

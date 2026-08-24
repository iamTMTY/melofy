'use client';

import { motion } from 'framer-motion';
import { useMelofy } from '@/hooks/useMelofy';
import type { LyricLine } from '@/lib/types';

interface LyricLineProps {
  lyric: LyricLine;
  isActive: boolean;
  isPast: boolean;
  showOriginal: boolean;
}

export function LyricLineView({ lyric, isActive, isPast, showOriginal }: LyricLineProps) {
  const { preferences } = useMelofy();

  const fontSizeMap = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
  };

  const fontSizeClass = fontSizeMap[preferences.fontSize] || 'text-base';

  return (
    <motion.div
      layout
      animate={{
        opacity: isActive ? 1 : isPast ? 0.4 : 0.2,
        scale: isActive ? 1 : 0.97,
      }}
      transition={{
        type: 'spring',
        bounce: 0,
        duration: 0.35,
      }}
      className={`group relative px-6 py-3 transition-colors duration-300 ${
        isActive ? 'text-white' : isPast ? 'text-white/40' : 'text-white/20'
      }`}
    >
      {/* Active line highlight */}
      {isActive && (
        <motion.div
          layoutId="active-line"
          transition={{
            type: 'spring',
            bounce: 0.2,
            duration: 0.3,
          }}
          className="absolute inset-0 rounded-xl bg-white/10 backdrop-blur-sm"
        />
      )}

      <div className="relative space-y-1">
        {/* Translated line (primary) */}
        <p
          className={`${fontSizeClass} font-medium leading-snug tracking-tight ${
            isActive ? 'drop-shadow-sm' : ''
          }`}
        >
          {lyric.translated || lyric.original}
        </p>

        {/* Original line (secondary, shown based on toggle) */}
        {showOriginal && lyric.translated && lyric.translated !== lyric.original && (
          <p
            className={`text-sm leading-snug text-white/60 ${
              isActive ? 'text-white/80' : ''
            }`}
          >
            {lyric.original}
          </p>
        )}
      </div>
    </motion.div>
  );
}

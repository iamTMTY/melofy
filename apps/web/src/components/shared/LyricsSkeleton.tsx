'use client';

import { motion } from 'framer-motion';

// Deterministic widths (no Math.random → no hydration mismatch, no per-render jitter).
// The middle entry stands in for the active, centered line and reads largest.
const LINES = [
  { w: '46%', active: false },
  { w: '62%', active: false },
  { w: '54%', active: false },
  { w: '72%', active: false },
  { w: '68%', active: true },
  { w: '58%', active: false },
  { w: '64%', active: false },
  { w: '50%', active: false },
  { w: '60%', active: false },
];

const ACTIVE_H: Record<string, string> = {
  small: 'h-7',
  medium: 'h-8',
  large: 'h-9',
};

const INACTIVE_H: Record<string, string> = {
  small: 'h-4',
  medium: 'h-5',
  large: 'h-6',
};

export function LyricsSkeleton({ fontSize = 'medium' }: { fontSize?: 'small' | 'medium' | 'large' }) {
  const activeH = ACTIVE_H[fontSize] ?? 'h-8';
  const inactiveH = INACTIVE_H[fontSize] ?? 'h-5';

  return (
    <div
      aria-hidden
      className="flex flex-1 min-h-0 flex-col items-center justify-center overflow-hidden"
      style={{
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)',
      }}
    >
      <div className="flex w-full flex-col items-center">
        {LINES.map((line, i) => (
          <div key={i} className="flex w-full items-center justify-center px-8 py-5">
            <motion.div
              className={`shimmer rounded-full ${line.active ? activeH : inactiveH} ${
                line.active ? 'bg-white/[0.22]' : 'bg-white/[0.1]'
              }`}
              style={{ width: line.w }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: line.active ? 1 : 0.55 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4, delay: i * 0.05 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

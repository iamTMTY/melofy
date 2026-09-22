'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_COVER } from '@/lib/platform';

interface AlbumArtBackgroundProps {
  imageUrl?: string;
  children?: React.ReactNode;
  fixed?: boolean;
  variant?: 'art' | 'plain' | 'black';
}

export function AlbumArtBackground({ imageUrl, children, fixed = false, variant = 'art' }: AlbumArtBackgroundProps) {
  const bg = imageUrl || DEFAULT_COVER;
  return (
    <div
      className={`relative ${fixed ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'} ${
        variant === 'black'
          ? 'bg-black'
          : variant === 'plain'
            ? 'bg-white dark:bg-[#0b0b0d]'
            : ''
      }`}
    >
      <div className="absolute inset-0 overflow-hidden">
        {variant === 'art' && (
        <AnimatePresence>
          <motion.div
            key={bg}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              type: 'spring',
              bounce: 0,
              duration: 0.8,
            }}
            className="absolute inset-0"
          >
            <div
              className="absolute inset-0 bg-cover bg-center scale-110"
              style={{ backgroundImage: `url(${bg})` }}
            />
            <div className="absolute inset-0 bg-black/60 backdrop-blur-3xl" />
          </motion.div>
        </AnimatePresence>
        )}

        <div className="absolute inset-0 bg-noise opacity-[0.015] pointer-events-none" />
      </div>

      <div className={`relative z-10 flex flex-col ${fixed ? 'h-full min-h-0' : 'min-h-[100dvh]'}`}>{children}</div>
    </div>
  );
}

const styles = `
.bg-noise {
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.1'/%3E%3C/svg%3E");
}
`;

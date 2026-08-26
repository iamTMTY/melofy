'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_COVER } from '@/lib/platform';

interface AlbumArtBackgroundProps {
  imageUrl?: string;
  children?: React.ReactNode;
  /**
   * Lock the surface to the viewport height instead of growing with content.
   * The background stays fixed and any scrolling happens inside a child region.
   */
  fixed?: boolean;
}

export function AlbumArtBackground({ imageUrl, children, fixed = false }: AlbumArtBackgroundProps) {
  // Fall back to the default cover so there's always an atmospheric backdrop.
  const bg = imageUrl || DEFAULT_COVER;
  return (
    <div className={`relative ${fixed ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'}`}>
      {/* Background Layer — clipped to container */}
      <div className="absolute inset-0 overflow-hidden">
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

        <div className="absolute inset-0 bg-noise opacity-[0.015] pointer-events-none" />
      </div>

      {/* Content */}
      <div className={`relative z-10 flex flex-col ${fixed ? 'h-full min-h-0' : 'min-h-[100dvh]'}`}>{children}</div>
    </div>
  );
}

const styles = `
.bg-noise {
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.1'/%3E%3C/svg%3E");
}
`;

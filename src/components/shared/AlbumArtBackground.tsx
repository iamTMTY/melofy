'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface AlbumArtBackgroundProps {
  imageUrl?: string;
  children?: React.ReactNode;
}

export function AlbumArtBackground({ imageUrl, children }: AlbumArtBackgroundProps) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Layer */}
      <AnimatePresence>
        {imageUrl && (
          <motion.div
            key={imageUrl}
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
            {/* Enlarged, blurred album art */}
            <div
              className="absolute inset-0 bg-cover bg-center scale-110"
              style={{ backgroundImage: `url(${imageUrl})` }}
            />
            {/* Darkening overlay for translucency effect */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-3xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grain texture overlay */}
      <div className="absolute inset-0 bg-noise opacity-[0.015] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
    </div>
  );
}

// Small noise SVG data URI for texture
const styles = `
.bg-noise {
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.1'/%3E%3C/svg%3E");
}
`;

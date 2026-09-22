'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js. Production only: a service worker in `next dev` serves stale
 * bundles across code changes and makes every reload a debugging exercise.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[Melofy] service worker registration failed:', err);
    });
  }, []);
  return null;
}

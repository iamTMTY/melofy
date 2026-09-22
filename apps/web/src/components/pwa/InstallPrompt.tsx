'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// `beforeinstallprompt` usually fires BEFORE React hydrates, so an inline script
// in layout.tsx stashes it on window and re-broadcasts as `melofy:bip`.
type BipEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
declare global {
  interface Window {
    __melofyBip?: BipEvent;
  }
}

const DISMISS_KEY = 'melofy-install-dismissed-at';
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/**
 * Small dismissible card offering to install the app. Android/desktop Chrome get
 * a real Install button (native prompt); iOS has no install API, so it gets the
 * Share → "Add to Home Screen" hint instead. Hidden once running installed.
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<'hidden' | 'native' | 'ios'>('hidden');
  const [bip, setBip] = useState<BipEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (at && Date.now() - at < DISMISS_FOR_MS) return;
    } catch {
      /* storage blocked — just show it */
    }

    const useBip = (e: BipEvent) => {
      setBip(e);
      setMode('native');
    };
    if (window.__melofyBip) useBip(window.__melofyBip);
    const onBip = () => window.__melofyBip && useBip(window.__melofyBip);
    window.addEventListener('melofy:bip', onBip);

    // No install event will ever come on iOS Safari — show the manual hint.
    if (isIOS()) setMode('ios');

    const onInstalled = () => setMode('hidden');
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('melofy:bip', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setMode('hidden');
  };

  const install = async () => {
    if (!bip) return;
    await bip.prompt();
    const { outcome } = await bip.userChoice;
    if (outcome === 'accepted') setMode('hidden');
    else dismiss();
  };

  return (
    <AnimatePresence>
      {mode !== 'hidden' && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
          role="dialog"
          aria-label="Install Melofy"
          className="fixed inset-x-4 bottom-14 z-30 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-80 rounded-2xl border border-black/[0.06] bg-white/90 p-4 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-[#1c1c1e]/90"
        >
          <div className="flex items-start gap-3">
            <img src="/icon-192-maskable.png" alt="" width={40} height={40} className="h-10 w-10 flex-shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Install Melofy</p>
              {mode === 'native' ? (
                <p className="mt-0.5 text-xs text-gray-500 dark:text-white/50">
                  Full-screen lyrics, one tap from your home screen.
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-gray-500 dark:text-white/50">
                  Tap <span className="font-semibold text-gray-700 dark:text-white/80">Share</span>, then{' '}
                  <span className="font-semibold text-gray-700 dark:text-white/80">Add to Home Screen</span>.
                </p>
              )}
            </div>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="-mr-1 -mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          {mode === 'native' && (
            <button
              onClick={install}
              className="mt-3 w-full rounded-xl bg-melofy-500 px-4 py-2 text-sm font-semibold text-white transition-transform duration-150 active:scale-[0.98]"
            >
              Install
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

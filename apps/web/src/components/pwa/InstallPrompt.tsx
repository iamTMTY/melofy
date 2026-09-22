'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { afterUserChoice, isInstallDismissed, resolveInstallMode, type InstallMode } from '@/lib/pwa';

// `beforeinstallprompt` usually fires BEFORE React hydrates, so an inline script
// in layout.tsx stashes it on window and re-broadcasts as `melofy:bip`.
type BipEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
declare global {
  interface Window {
    __melofyBip?: BipEvent;
  }
}

const DISMISS_KEY = 'melofy-install-dismissed-at';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function InstallPrompt() {
  const [mode, setMode] = useState<InstallMode>('hidden');
  const [bip, setBip] = useState<BipEvent | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = isInstallDismissed(localStorage.getItem(DISMISS_KEY), Date.now());
    } catch {}
    const ctx = { standalone: isStandalone(), dismissed, ios: isIOS() };
    if (ctx.standalone || ctx.dismissed) return;

    const apply = (hasNativePrompt: boolean) => setMode(resolveInstallMode({ ...ctx, hasNativePrompt }));
    const useBip = (e: BipEvent) => {
      setBip(e);
      apply(true);
    };
    if (window.__melofyBip) useBip(window.__melofyBip);
    else apply(false);
    const onBip = () => window.__melofyBip && useBip(window.__melofyBip);
    window.addEventListener('melofy:bip', onBip);

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
    } catch {}
    setMode('hidden');
  };

  const install = async () => {
    if (!bip) return;
    await bip.prompt();
    const { outcome } = await bip.userChoice;
    if (afterUserChoice(outcome) === 'installed') setMode('hidden');
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

'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { SUPPORTED_LANGUAGES } from '@/lib/types';
import { CYCLE_ORDER, LOADING_PHRASES, type LoadState } from '@/lib/loadingPhrases';

const nativeName = (code: string) => SUPPORTED_LANGUAGES.find((l) => l.code === code)?.nativeName ?? code;

const INTERVAL_MS = 1750;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Randomized orders per run — languages shuffled but ALWAYS English first,
// phrases shuffled.
function makeOrders(state: LoadState) {
  return {
    langOrder: ['en', ...shuffle(CYCLE_ORDER.filter((c) => c !== 'en'))],
    phraseOrder: shuffle(LOADING_PHRASES[state].map((_, i) => i)),
  };
}

/**
 * The loading state on /playing. Cycles a LIST of phrases, each in a language —
 * both in a RANDOM order (English shown first) — advancing every tick so it
 * never repeats, with a soft fade and a slow ambient glow behind it.
 */
export function LoadingCycler({ state }: { state: LoadState }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  const [orders, setOrders] = useState(() => makeOrders(state));

  // Reshuffle + restart (English first) whenever the state changes.
  useEffect(() => {
    setOrders(makeOrders(state));
    setN(0);
    const id = setInterval(() => setN((prev) => prev + 1), INTERVAL_MS);
    return () => clearInterval(id);
  }, [state]);

  const phrases = LOADING_PHRASES[state];
  const code = orders.langOrder[n % orders.langOrder.length];
  const entry = phrases[orders.phraseOrder[n % orders.phraseOrder.length]];
  const phrase = entry[code] ?? entry.en;

  // Simple, soft fade out → fade in (no slide).
  const enter = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };

  return (
    <div className="relative flex flex-col items-center justify-center gap-3 px-8 text-center">
      {/* Ambient glow — soft, slow breathing behind the text */}
      {!reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -z-10 h-48 w-48 rounded-full bg-melofy-500/25 blur-[64px]"
          animate={{ scale: [1, 1.18, 1], opacity: [0.45, 0.8, 0.45] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <div className="min-h-[2.75rem] flex items-center justify-center sm:min-h-[3.25rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${state}-${n}`}
            dir="auto"
            {...enter}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
            className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-4xl"
          >
            {phrase}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Language label — cross-fades in step so you can see where it's going */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={`lang-${n}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400 dark:text-white/35"
        >
          {nativeName(code)}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

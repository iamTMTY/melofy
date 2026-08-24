'use client';

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMelofy } from '@/hooks/useMelofy';
import { SUPPORTED_LANGUAGES } from '@/lib/types';
import { GlobeIcon } from './icons/GlobeIcon';
import { CheckIcon } from './icons/CheckIcon';

interface LanguagePickerProps {
  /** Compact trigger for dense chrome like the now-playing bar. */
  compact?: boolean;
  /** Open the dropdown ABOVE the trigger — for bottom sheets where there's no
   *  room below (otherwise the list is clipped off the bottom of the screen). */
  dropUp?: boolean;
}

export function LanguagePicker({ compact = false, dropUp = false }: LanguagePickerProps) {
  const { preferences, setPreferences } = useMelofy();
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const current =
    SUPPORTED_LANGUAGES.find((l) => l.code === preferences.targetLanguage) ??
    SUPPORTED_LANGUAGES[0];
  const selectedIndex = SUPPORTED_LANGUAGES.findIndex((l) => l.code === current.code);

  const select = useCallback(
    (code: string) => {
      setPreferences({ targetLanguage: code });
      setOpen(false);
    },
    [setPreferences]
  );

  // Dismiss on outside pointer / Escape, and wire up keyboard navigation.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(SUPPORTED_LANGUAGES.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        select(SUPPORTED_LANGUAGES[activeIdx].code);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, activeIdx, select]);

  // Open anchored to the current selection and scroll it into view.
  useLayoutEffect(() => {
    if (!open) return;
    setActiveIdx(selectedIndex < 0 ? 0 : selectedIndex);
    const list = listRef.current;
    if (list) {
      const el = list.querySelector<HTMLElement>('[data-selected="true"]');
      if (el) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.offsetHeight / 2;
    }
  }, [open, selectedIndex]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Translation language: ${current.name}`}
        className={
          compact
            ? 'pressable inline-flex items-center gap-1.5 rounded-full bg-black/[0.05] px-2.5 py-1.5 text-[12px] font-semibold text-gray-600 transition-colors duration-200 hover:bg-black/[0.08] dark:bg-white/[0.08] dark:text-white/60 dark:hover:bg-white/[0.14]'
            : 'pressable inline-flex items-center gap-2 rounded-full glass-surface-light border border-black/[0.06] px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors duration-200 hover:border-black/[0.12] dark:border-white/[0.08] dark:text-white/75 dark:hover:border-white/[0.16]'
        }
      >
        <GlobeIcon className={compact ? 'opacity-60' : 'text-melofy-500'} />
        <span className={compact ? 'max-w-[68px] truncate' : ''}>{current.nativeName}</span>
        <motion.svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className="opacity-40"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            aria-label="Select translation language"
            initial={{ opacity: 0, scale: 0.94, y: dropUp ? 6 : -6, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.96, y: dropUp ? 4 : -4, filter: 'blur(4px)' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.28 }}
            className={`absolute z-50 w-56 overflow-hidden rounded-2xl glass-surface-heavy border border-black/[0.08] shadow-xl shadow-black/20 dark:border-white/[0.1] ${
              dropUp ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]'
            } ${
              compact
                ? `right-0 ${dropUp ? 'origin-bottom-right' : 'origin-top-right'}`
                : `left-[-40%] -translate-x-1/2 ${dropUp ? 'origin-bottom' : 'origin-top'}`
            }`}
          >
            <div className="px-3 pt-3 pb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30">
                Translate to
              </p>
            </div>
            <div ref={listRef} className="max-h-64 overflow-y-auto hide-scrollbar px-1.5 pb-1.5">
              {SUPPORTED_LANGUAGES.map((lang, i) => {
                const isSelected = lang.code === current.code;
                const isActive = i === activeIdx;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-selected={isSelected}
                    onClick={() => select(lang.code)}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-100 ${
                      isActive ? 'bg-black/[0.05] dark:bg-white/[0.08]' : ''
                    }`}
                  >
                    <span className="min-w-0">
                      <span className={`block truncate text-sm font-medium ${isSelected ? 'text-melofy-500' : 'text-gray-800 dark:text-white/85'}`}>
                        {lang.nativeName}
                      </span>
                      {lang.nativeName !== lang.name && (
                        <span className="block truncate text-[11px] text-gray-400 dark:text-white/35">
                          {lang.name}
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <span className="flex-shrink-0 text-melofy-500">
                        <CheckIcon />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMelofy } from '@/hooks/useMelofy';
import { SERVICES } from '@/components/player/services';
import type { MusicService } from '@/lib/types';

const META = Object.fromEntries(SERVICES.map((s) => [s.id, { name: s.name, color: s.color }])) as Record<
  MusicService,
  { name: string; color: string }
>;

/**
 * Switches which streaming platform the /playing screen follows. Only rendered
 * when 2+ platforms are connected — otherwise there's nothing to switch. Each
 * option previews that platform's current track (art + title + artist).
 */
export function SourceSwitcher() {
  const { sources, activeSource, setActiveSource } = useMelofy();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const connected = SERVICES.filter((s) => sources[s.id]?.connected);
  if (connected.length < 2 || !activeSource) return null;

  const activeMeta = META[activeSource];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Streaming source: ${activeMeta?.name}`}
        className="pressable inline-flex items-center gap-1.5 rounded-full bg-black/[0.05] px-2.5 py-1.5 text-[12px] font-semibold text-gray-600 transition-colors duration-200 hover:bg-black/[0.08] dark:bg-white/[0.08] dark:text-white/60 dark:hover:bg-white/[0.14]"
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activeMeta?.color }} />
        <span className="max-w-[92px] truncate">{activeMeta?.name}</span>
        <motion.svg
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className="opacity-40" animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            aria-label="Select streaming source"
            initial={{ opacity: 0, scale: 0.94, y: -6, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.96, y: -4, filter: 'blur(4px)' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.28 }}
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 origin-top-right overflow-hidden rounded-2xl glass-surface-heavy border border-black/[0.08] shadow-xl shadow-black/20 dark:border-white/[0.1]"
          >
            <div className="px-3 pt-3 pb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30">
                Now playing on
              </p>
            </div>
            <div className="px-1.5 pb-1.5 flex flex-col gap-2">
              {connected.map((s) => {
                const state = sources[s.id]!;
                const isActive = s.id === activeSource;
                const track = state.track;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      setActiveSource(s.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-100 ${
                      isActive ? 'bg-black/[0.05] dark:bg-white/[0.08]' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                    }`}
                  >
                    {track?.albumArtUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={track.albumArtUrl} alt="" className="h-9 w-9 flex-shrink-0 rounded-md object-cover" />
                    ) : (
                      <span
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                        style={{ backgroundColor: META[s.id]?.color }}
                      >
                        {META[s.id]?.name.slice(0, 1)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: META[s.id]?.color }} />
                        <span className="truncate text-[11px] font-medium text-gray-500 dark:text-white/40">
                          {META[s.id]?.name}
                        </span>
                      </span>
                      <span className="block truncate text-sm font-semibold text-gray-800 dark:text-white/90">
                        {track?.title ?? 'Nothing playing'}
                      </span>
                      {track?.artist && (
                        <span className="block truncate text-[11px] text-gray-400 dark:text-white/35">{track.artist}</span>
                      )}
                    </span>
                    {isActive && (
                      <svg className="flex-shrink-0 text-melofy-500" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
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

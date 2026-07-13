'use client';

import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMelofy } from '@/hooks/useMelofy';
import { useLyricSync } from '@/hooks/useLyricSync';
import { LyricLineView } from './LyricLineView';
import { LoadingSkeleton } from '../shared/LoadingSkeleton';

export function LyricsView() {
  const { translatedLyrics, preferences, playback, isTranslating, isLoadingLyrics, sourceLanguage } = useMelofy();
  const { containerRef, activeLineIndex } = useLyricSync(translatedLyrics);

  const noTrack = !playback.track;
  const noLyrics = translatedLyrics.length === 0 && !isLoadingLyrics && !isTranslating;
  const showOriginal = preferences.showOriginalLyrics;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Empty states */}
      <AnimatePresence>
        {noTrack && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center"
          >
            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl backdrop-blur-sm ${
              playback.connected ? 'bg-green-500/10' : 'bg-black/5 dark:bg-white/5'
            }`}>
              {playback.connected ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 dark:text-green-400">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12l3 3 5-5" />
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-white/60">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              )}
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white/80">
              {playback.connected ? 'Ready to Translate' : 'Nothing Playing'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-white/50 max-w-xs">
              {playback.connected
                ? 'Play a song on Spotify and it will appear here with synced, translated lyrics.'
                : 'Connect your Spotify account and start playing a song to see translated lyrics in real-time.'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {noLyrics && playback.track && !isLoadingLyrics && !isTranslating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center"
          >
            <p className="text-sm text-gray-500 dark:text-white/50">
              No lyrics available for this track yet.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading skeleton */}
      <LoadingSkeleton />

      {/* Lyrics list */}
      {translatedLyrics.length > 0 && (
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto scroll-fade-bottom py-[40vh] px-2"
          style={{ scrollBehavior: 'smooth' }}
        >
          {/* Top padding spacer for first line centering */}
          <div className="h-[30vh]" />

          {translatedLyrics.map((lyric, idx) => (
            <LyricLineView
              key={lyric.index}
              lyric={lyric}
              isActive={idx === activeLineIndex}
              isPast={idx < activeLineIndex}
              showOriginal={showOriginal}
            />
          ))}

          {/* Bottom padding spacer */}
          <div className="h-[30vh]" />
        </div>
      )}
    </div>
  );
}

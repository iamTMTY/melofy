'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMelofy } from '@/hooks/useMelofy';
import { useTranslation } from '@/hooks/useTranslation';
import type { MusicService, TrackMetadata } from '@/lib/types';

interface ServiceConfig {
  id: MusicService;
  name: string;
  route: string;
  color: string;
}

const SERVICES: ServiceConfig[] = [
  { id: 'spotify', name: 'Spotify', route: '/playing', color: '#1DB954' },
  { id: 'apple_music', name: 'Apple Music', route: '/apple-music', color: '#FA233B' },
  { id: 'youtube_music', name: 'YouTube Music', route: '/youtube-music', color: '#FF0000' },
];

function connectSpotify() {
  window.location.href = '/api/auth/spotify/callback';
}

function PlaySongModal({ service, onClose }: { service: ServiceConfig; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1c1c1e] p-8 text-center border border-gray-200 dark:border-white/10 shadow-2xl"
      >
        <div
          className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-5"
          style={{ backgroundColor: `${service.color}15` }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={service.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>

        <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white mb-2">
          Connected to {service.name}
        </h2>
        <p className="text-sm text-gray-500 dark:text-white/40 mb-6 leading-relaxed">
          Play a song on {service.name} — on your phone, desktop, or web player. It will appear here automatically.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-gray-200 dark:border-white/10 px-4 py-3 text-sm font-medium text-gray-700 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 active:scale-[0.97] transition-all duration-200"
          >
            Got it
          </button>
          <button
            onClick={() => { onClose(); window.open('https://open.spotify.com', '_blank'); }}
            className="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white hover:opacity-90 active:scale-[0.97] transition-all duration-200"
            style={{ backgroundColor: service.color }}
          >
            Open {service.name}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function ServiceCards() {
  const { playback } = useMelofy();
  const { fetchTranslation } = useTranslation();
  const router = useRouter();
  const activeService = playback.service;
  const activeTrack = playback.track;
  const [modalService, setModalService] = useState<ServiceConfig | null>(null);

  const handleCardClick = useCallback((service: ServiceConfig) => {
    const isConnected = activeService === service.id;
    const hasTrack = isConnected && !!activeTrack;

    if (!isConnected) {
      if (service.id === 'spotify') {
        connectSpotify();
      } else {
        setModalService(service);
      }
      return;
    }

    if (isConnected && !hasTrack) {
      setModalService(service);
      return;
    }

    // Connected + playing → navigate and auto-translate
    fetchTranslation();
    router.push(service.route);
  }, [activeService, activeTrack, fetchTranslation, router]);

  return (
    <>
      <div className="w-full max-w-lg mx-auto px-6">
      <h2 className="text-sm font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider mb-5">
        Your Services
      </h2>
        <div className="grid gap-4">
          {SERVICES.map((service, i) => {
            const isConnected = activeService === service.id;
            const isPlaying = isConnected && !!activeTrack && playback.isPlaying;

            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.4, delay: i * 0.06 }}
              >
                <ServiceCard
                  service={service}
                  isConnected={isConnected}
                  isPlaying={isPlaying}
                  track={activeTrack}
                  onClick={() => handleCardClick(service)}
                />
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {modalService && (
          <PlaySongModal service={modalService} onClose={() => setModalService(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

function ServiceCard({
  service,
  isConnected,
  isPlaying,
  track,
  onClick,
}: {
  service: ServiceConfig;
  isConnected: boolean;
  isPlaying: boolean;
  track: TrackMetadata | null;
  onClick: () => void;
}) {
  return (
    <motion.div
      whileTap={isConnected || service.id === 'spotify' ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border transition-all duration-200 cursor-pointer ${
        isConnected
          ? 'border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:border-gray-300 dark:hover:border-white/20 hover:shadow-md'
          : 'border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01] opacity-60 hover:opacity-80'
      }`}
    >
      <div className="flex items-center gap-5 p-5">
        <div
          className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: isConnected ? service.color : `${service.color}30` }}
        >
          {service.id === 'spotify' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02z" />
            </svg>
          ) : service.id === 'apple_music' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.429 16.286V7.714L17.143 5.57v13.858L10.571 16.28zM6.857 7.714v8.572c0 .473-.336.857-.75.857s-.75-.384-.75-.857V7.714c0-.473.336-.857.75-.857s.75.384.75.857z" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M21.582 6.186a2.506 2.506 0 0 0-1.768-1.768C18.254 4 12 4 12 4s-6.254 0-7.814.418a2.506 2.506 0 0 0-1.768 1.768C2 7.746 2 12 2 12s0 4.254.418 5.814a2.506 2.506 0 0 0 1.768 1.768c1.56.42 7.814.418 7.814.418s6.254 0 7.814-.418a2.506 2.506 0 0 0 1.768-1.768C22 16.254 22 12 22 12s0-4.254-.418-5.814zM10 15.464V8.536L16 12l-6 3.464z" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{service.name}</h3>
            <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              isConnected
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : 'bg-gray-200 dark:bg-white/5 text-gray-400 dark:text-white/30'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`} />
              {isConnected ? 'Connected' : 'Tap to connect'}
            </div>
          </div>

          {isPlaying && track && (
            <div className="mt-1 flex items-center gap-2">
              {track.albumArtUrl && (
                <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-md">
                  <Image src={track.albumArtUrl} alt="" fill className="object-cover" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-600 dark:text-white/70 truncate">
                  {track.title}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-white/30 truncate">
                  {track.artist}
                </p>
              </div>
              <div className="ml-auto flex items-end gap-[1.5px] h-4 flex-shrink-0">
                {[0.4, 0.8, 0.3, 0.6].map((h, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: [2, h * 14, 2] }}
                    transition={{ repeat: Infinity, duration: 0.7 + i * 0.12, ease: 'easeInOut' }}
                    className="w-[2px] rounded-full"
                    style={{ backgroundColor: service.color }}
                  />
                ))}
              </div>
            </div>
          )}

          {isConnected && !isPlaying && (
            <p className="text-xs text-gray-400 dark:text-white/20 mt-1">
              Nothing playing — tap to open
            </p>
          )}
        </div>

        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 dark:text-white/15 flex-shrink-0">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </motion.div>
  );
}

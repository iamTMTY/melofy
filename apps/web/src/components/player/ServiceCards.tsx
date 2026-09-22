'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useMelofy } from '@/hooks/useMelofy';
import { startSpotifyConnect } from '@/lib/spotify-auth';
import { canUseExtension } from '@/lib/platform';
import { SERVICES, type ServiceConfig } from './services';
import { ServiceCard } from './ServiceCard';
import { PlaySongModal } from './PlaySongModal';
import { ExtensionInstallModal } from './ExtensionInstallModal';
import { AppleMusicModal } from './AppleMusicModal';

export function ServiceCards({ extensionDetected = false }: { extensionDetected?: boolean }) {
  const { sources, setActiveSource } = useMelofy();
  const router = useRouter();
  const [modalService, setModalService] = useState<ServiceConfig | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [appleOpen, setAppleOpen] = useState(false);

  const [extensionCapable, setExtensionCapable] = useState(true);
  useEffect(() => setExtensionCapable(canUseExtension()), []);
  const visibleServices = SERVICES.filter(
    (s) => s.id !== 'youtube_music' || extensionDetected || extensionCapable
  );

  const handleCardClick = useCallback((service: ServiceConfig) => {
    const state = sources[service.id];
    const isConnected = !!state?.connected;
    const hasTrack = !!state?.track;

    if (!isConnected) {
      if (service.id === 'spotify') {
        const redirected = startSpotifyConnect();
        if (!redirected) setModalService(service);
      } else if (service.id === 'youtube_music') {
        if (extensionDetected) setModalService(service);
        else setInstallOpen(true);
      } else if (service.id === 'apple_music') {
        setAppleOpen(true);
      } else {
        setModalService(service);
      }
      return;
    }

    if (isConnected && !hasTrack) {
      setModalService(service);
      return;
    }

    setActiveSource(service.id);
    router.push(service.route);
  }, [sources, extensionDetected, setActiveSource, router]);

  return (
    <>
      <div className="w-full max-w-lg mx-auto px-6">
      <h2 className="text-sm font-medium text-gray-400 dark:text-white uppercase tracking-wider mb-5">
        Your Services
      </h2>
        <div className="grid gap-4">
          {visibleServices.map((service, i) => {
            const state = sources[service.id];
            const isConnected = !!state?.connected;
            const isPlaying = isConnected && !!state?.track && !!state?.isPlaying;

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
                  track={state?.track ?? null}
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
        {installOpen && <ExtensionInstallModal onClose={() => setInstallOpen(false)} />}
        {appleOpen && <AppleMusicModal onClose={() => setAppleOpen(false)} />}
      </AnimatePresence>
    </>
  );
}

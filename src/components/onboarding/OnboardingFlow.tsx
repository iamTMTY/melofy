'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMelofy } from '@/hooks/useMelofy';
import { SUPPORTED_LANGUAGES, type MusicService } from '@/lib/types';

const MUSIC_SERVICES: { id: MusicService; name: string; icon: string; color: string }[] = [
  {
    id: 'spotify',
    name: 'Spotify',
    icon: 'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02z',
    color: 'bg-[#1DB954]',
  },
  {
    id: 'apple_music',
    name: 'Apple Music',
    icon: 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.429 16.286V7.714L17.143 5.57v13.858L10.571 16.28zM6.857 7.714v8.572c0 .473-.336.857-.75.857s-.75-.384-.75-.857V7.714c0-.473.336-.857.75-.857s.75.384.75.857z',
    color: 'bg-[#FA233B]',
  },
  {
    id: 'youtube_music',
    name: 'YouTube Music',
    icon: 'M21.582 6.186a2.506 2.506 0 0 0-1.768-1.768C18.254 4 12 4 12 4s-6.254 0-7.814.418a2.506 2.506 0 0 0-1.768 1.768C2 7.746 2 12 2 12s0 4.254.418 5.814a2.506 2.506 0 0 0 1.768 1.768c1.56.42 7.814.418 7.814.418s6.254 0 7.814-.418a2.506 2.506 0 0 0 1.768-1.768C22 16.254 22 12 22 12s0-4.254-.418-5.814zM10 15.464V8.536L16 12l-6 3.464z',
    color: 'bg-[#FF0000]',
  },
];

export function OnboardingFlow() {
  const router = useRouter();
  const { preferences, setPreferences } = useMelofy();
  const [step, setStep] = useState(0);
  const [selectedService, setSelectedService] = useState<MusicService | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState(preferences.targetLanguage);

  const handleConnectSpotify = useCallback(() => {
    window.location.href = '/api/auth/spotify/callback';
  }, []);

  const handleNext = useCallback(() => {
    if (step === 0 && selectedService) {
      setPreferences({ linkedService: selectedService });
      setStep(1);
    } else if (step === 1 && selectedLanguage) {
      setPreferences({ targetLanguage: selectedLanguage });
      setStep(2);
    }
  }, [step, selectedService, selectedLanguage, setPreferences]);

  const handleFinish = useCallback(() => {
    if (selectedService === 'spotify') {
      handleConnectSpotify();
    } else {
      router.push('/');
    }
  }, [selectedService, handleConnectSpotify, router]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-screen flex-col items-center justify-center px-6 py-12"
    >
      <div className="mb-12 flex gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{
              width: step === i ? 24 : 8,
              backgroundColor: step >= i ? '#8b5cf6' : 'rgba(255,255,255,0.2)',
            }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            className="h-2 rounded-full"
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="step-0"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            className="w-full max-w-sm space-y-6"
          >
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                Choose Your Music Service
              </h1>
              <p className="text-sm text-gray-500 dark:text-white/50">
                Connect the platform you use to stream music.
              </p>
            </div>

            <div className="space-y-3">
              {MUSIC_SERVICES.map((service) => (
                <motion.button
                  key={service.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedService(service.id)}
                  className={`flex w-full items-center gap-4 rounded-2xl border p-4 transition-all duration-200 ${
                    selectedService === service.id
                      ? 'border-melofy-500 bg-melofy-500/10'
                      : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                  }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${service.color}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <path d={service.icon} />
                    </svg>
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {service.name}
                  </span>
                  {selectedService === service.id && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-melofy-500"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            className="w-full max-w-sm space-y-6"
          >
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                Your Reading Language
              </h1>
              <p className="text-sm text-gray-500 dark:text-white/50">
                Lyrics will be translated into this language.
              </p>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto scroll-fade-bottom">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <motion.button
                  key={lang.code}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedLanguage(lang.code)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ${
                    selectedLanguage === lang.code
                      ? 'bg-melofy-500/10 text-melofy-600 dark:text-melofy-400'
                      : 'hover:bg-gray-50 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="text-lg">{lang.nativeName}</span>
                  <span className="text-sm text-gray-400">{lang.name}</span>
                  {selectedLanguage === lang.code && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-melofy-500"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            className="w-full max-w-sm space-y-6"
          >
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {selectedService === 'spotify' ? 'Connect Your Spotify' : 'Link Your Account'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-white/50">
                {selectedService === 'spotify'
                  ? "You'll be redirected to Spotify to authorize Melofy to see what you're playing."
                  : 'Apple Music and YouTube Music integration coming soon.'}
              </p>
            </div>

            {selectedService === 'spotify' && (
              <div className="glass-surface rounded-2xl border border-white/20 p-6 text-center space-y-4">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="#1DB954" className="mx-auto">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2z" />
                </svg>
                <p className="text-sm text-gray-500 dark:text-white/40">
                  Melofy needs permission to see what you're playing on Spotify. You can revoke this at any time from your Spotify account settings.
                </p>
              </div>
            )}

            {selectedService !== 'spotify' && (
              <div className="glass-surface rounded-2xl border border-white/20 p-6 text-center">
                <p className="text-sm text-gray-500 dark:text-white/40">
                  Mobile app integration coming soon.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-10 w-full max-w-sm"
      >
        {step < 2 ? (
          <button
            onClick={handleNext}
            disabled={(step === 0 && !selectedService) || (step === 1 && !selectedLanguage)}
            className={`flex w-full items-center justify-center rounded-2xl px-6 py-3.5 text-base font-semibold transition-all duration-200 pressable ${
              (step === 0 && !selectedService) || (step === 1 && !selectedLanguage)
                ? 'bg-gray-200 dark:bg-white/5 text-gray-400 cursor-not-allowed'
                : 'bg-melofy-500 text-white shadow-lg shadow-melofy-500/25 hover:bg-melofy-600'
            }`}
          >
            Continue
          </button>
        ) : (
          <button
            onClick={handleFinish}
            className={`flex w-full items-center justify-center rounded-2xl px-6 py-3.5 text-base font-semibold transition-all duration-200 pressable ${
              selectedService === 'spotify'
                ? 'bg-[#1DB954] text-white shadow-lg shadow-[#1DB954]/25 hover:bg-[#1ed760]'
                : 'bg-melofy-500 text-white shadow-lg shadow-melofy-500/25 hover:bg-melofy-600'
            }`}
          >
            {selectedService === 'spotify' ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="mr-2">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02z" />
                </svg>
                Connect Spotify
              </>
            ) : (
              'Get Started'
            )}
          </button>
        )}

        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="mt-3 w-full text-center text-sm text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/50 transition-colors"
          >
            Back
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

'use client';

import { useEffect, useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useRouter } from 'next/navigation';
import { MelofyProvider, useMelofy } from '@/hooks/useMelofy';
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer';
import { AlbumArtBackground } from '@/components/shared/AlbumArtBackground';
import { ServiceCards } from '@/components/player/ServiceCards';
import { SUPPORTED_LANGUAGES } from '@/lib/types';

function connectSpotify() {
  window.location.href = '/api/auth/spotify/callback';
}

function LanguageSelector() {
  const { preferences, setPreferences } = useMelofy();

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-sm px-4 py-2">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 flex-shrink-0">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
      <select
        value={preferences.targetLanguage}
        onChange={(e) => setPreferences({ targetLanguage: e.target.value })}
        className="text-xs font-medium bg-transparent text-gray-600 dark:text-white/60 border-none outline-none cursor-pointer appearance-none pr-1"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
}

function BrandMark() {
  return (
    <h1 className="text-8xl font-bold tracking-tighter leading-none bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">
      Melofy
    </h1>
  );
}

function Dashboard() {
  const { playback, preferences } = useMelofy();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const expiresIn = searchParams.get('expires_in');
    const connected = searchParams.get('spotify_connected');

    if (connected === 'true' && accessToken) {
      const expiresAt = Date.now() + (parseInt(expiresIn || '3600', 10) * 1000);

      localStorage.setItem('melofy-spotify-access-token', accessToken);
      if (refreshToken) {
        localStorage.setItem('melofy-spotify-refresh-token', refreshToken);
      }
      localStorage.setItem('melofy-spotify-expires-at', String(expiresAt));

      setSpotifyToken(accessToken);
      router.replace('/');
      return;
    }

    const token = localStorage.getItem('melofy-spotify-access-token');
    const expiresAt = localStorage.getItem('melofy-spotify-expires-at');

    if (token && expiresAt && Date.now() < parseInt(expiresAt, 10)) {
      setSpotifyToken(token);
    } else if (token) {
      const refreshToken = localStorage.getItem('melofy-spotify-refresh-token');
      if (refreshToken) {
        fetch('/api/auth/spotify/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.access_token) {
              localStorage.setItem('melofy-spotify-access-token', data.access_token);
              localStorage.setItem('melofy-spotify-expires-at', String(Date.now() + data.expires_in * 1000));
              if (data.refresh_token) {
                localStorage.setItem('melofy-spotify-refresh-token', data.refresh_token);
              }
              setSpotifyToken(data.access_token);
            }
          })
          .catch(() => {});
      }
    }
  }, [searchParams, router]);

  useSpotifyPlayer(spotifyToken);

  const isConnected = !!spotifyToken || playback.connected;
  const albumArt = playback.track?.albumArtUrl;

  return (
    <AlbumArtBackground imageUrl={albumArt}>
      <main className="min-h-screen flex flex-col">
        {/* Hero */}
        <div className="text-center pt-32 pb-10 px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
          >
            <BrandMark />
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.5, delay: 0.06 }}
            className="mt-5 text-lg text-gray-500 dark:text-white/40 max-w-md mx-auto leading-relaxed"
          >
            Lyrics that move with the music. AI-powered translation, perfectly synced.
          </motion.p>

          {!isConnected && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4, delay: 0.1 }}
              className="mt-6"
            >
              <button
                onClick={connectSpotify}
                className="inline-flex items-center gap-2 rounded-full bg-[#1DB954] px-6 py-3 text-sm font-semibold text-white hover:bg-[#1ed760] active:scale-[0.97] transition-all duration-200 shadow-lg shadow-[#1DB954]/20"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02z" />
                </svg>
                Connect Spotify
              </button>
            </motion.div>
          )}
        </div>

        {/* Language selector */}
        <div className="flex justify-center mb-8">
          <LanguageSelector />
        </div>

        {/* Service cards */}
        <div className="pb-16">
          <ServiceCards />
        </div>
      </main>
    </AlbumArtBackground>
  );
}

export default function HomePage() {
  return (
    <MelofyProvider>
      <Suspense fallback={<div className="min-h-screen bg-[#1c1c1e]" />}>
        <Dashboard />
      </Suspense>
    </MelofyProvider>
  );
}

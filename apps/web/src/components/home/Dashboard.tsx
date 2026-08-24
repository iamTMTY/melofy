'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams, useRouter } from 'next/navigation';
import { useMelofy } from '@/hooks/useMelofy';
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer';
import { useYouTubeMusicPlayer } from '@/hooks/useYouTubeMusicPlayer';
import { startSpotifyConnect } from '@/lib/spotify-auth';
import { AlbumArtBackground } from '@/components/shared/AlbumArtBackground';
import { ServiceCards } from '@/components/player/ServiceCards';
import { LanguagePicker } from '@/components/shared/LanguagePicker';
import { ByokButton } from '@/components/shared/ByokButton';
import { BrandMark } from './BrandMark';

export function Dashboard() {
  const { sources, setSourcePlayback } = useMelofy();
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

  // Remembered connection → reflect "connected" immediately, without waiting for
  // the first successful playback poll. This is what stops the UI from showing
  // "Tap to connect" (and re-triggering OAuth) for an already-connected user.
  useEffect(() => {
    if (spotifyToken) {
      setSourcePlayback('spotify', { connected: true });
    }
  }, [spotifyToken, setSourcePlayback]);

  useSpotifyPlayer(spotifyToken);
  const { extensionDetected } = useYouTubeMusicPlayer();

  // Hero connect button hides once Spotify is connected. Background art uses
  // whichever platform currently has a track.
  const isConnected = !!spotifyToken || !!sources.spotify?.connected;
  const albumArt =
    sources.spotify?.track?.albumArtUrl || sources.youtube_music?.track?.albumArtUrl;

  return (
    <AlbumArtBackground imageUrl={albumArt}>
      <main className="min-h-screen flex flex-col">
        {/* Hero */}
        <div className="text-center pt-24 pb-10 px-6">
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
            className="mt-5 text-lg text-gray-500 dark:text-white max-w-md mx-auto leading-relaxed"
          >
            AI-powered lyric translation, perfectly synced. 10 free translations or{' '}
            <ByokButton
              label="BYOK for unlimited translations"
              className="underline decoration-melofy-400/50 underline-offset-2 transition-colors duration-200 hover:text-gray-700 dark:hover:text-white/80"
            />
            .
          </motion.p>
        </div>

        {/* Language selector */}
        <div className="flex justify-center mb-8">
          <LanguagePicker />
        </div>

        {/* Service cards */}
        <div className="pb-16">
          <ServiceCards extensionDetected={extensionDetected} />
        </div>
      </main>
    </AlbumArtBackground>
  );
}

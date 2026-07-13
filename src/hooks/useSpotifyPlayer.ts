'use client';

import { useEffect, useRef, useState } from 'react';
import { useMelofy } from './useMelofy';
import type { MusicService } from '@/lib/types';

interface SpotifyTrack {
  item: {
    name: string;
    artists: { name: string }[];
    album: {
      name: string;
      images: { url: string }[];
    };
    duration_ms: number;
  };
  is_playing: boolean;
  progress_ms: number;
  currently_playing_type: string;
}

declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady: () => void;
    onYouTubeIframeAPIReady: () => void;
  }
}

function mapSpotifyTrack(track: SpotifyTrack, positionMs: number | null) {
  const item = track.item;
  return {
    artist: item.artists.map((a) => a.name).join(', '),
    title: item.name,
    album: item.album.name,
    albumArtUrl: item.album.images?.[0]?.url || '',
    durationMs: item.duration_ms,
    service: 'spotify' as MusicService,
  };
}

export function useSpotifyPlayer(token: string | null) {
  const { playback, setPlayback } = useMelofy();
  const [isReady, setIsReady] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playerRef = useRef<any>(null);

  // Poll Spotify Web API for current playback (works across all devices)
  useEffect(() => {
    if (!token) return;

    let attempts = 0;
    let tokenValid = false;

    const pollCurrentlyPlaying = async () => {
      attempts++;

      try {
        const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Token is valid — mark connected
        if (!tokenValid) {
          tokenValid = true;
          setPlayback({ connected: true, service: 'spotify' });
        }

        if (res.status === 204) {
          // Nothing playing — but we're connected
          return;
        }

        if (!res.ok) {
          if (res.status === 401) {
            // Token expired — try refreshing
            const refreshToken = localStorage.getItem('melofy-spotify-refresh-token');
            if (refreshToken) {
              const refreshRes = await fetch('/api/auth/spotify/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken }),
              });
              if (refreshRes.ok) {
                const data = await refreshRes.json();
                if (data.access_token) {
                  localStorage.setItem('melofy-spotify-access-token', data.access_token);
                  localStorage.setItem('melofy-spotify-expires-at', String(Date.now() + data.expires_in * 1000));
                  if (data.refresh_token) {
                    localStorage.setItem('melofy-spotify-refresh-token', data.refresh_token);
                  }
                }
              }
            }
          }
          return;
        }

        const data: SpotifyTrack = await res.json();

        if (data.currently_playing_type !== 'track' || !data.item) return;

        setPlayback({
          connected: true,
          service: 'spotify',
          isPlaying: data.is_playing,
          positionMs: data.progress_ms,
          track: mapSpotifyTrack(data, data.progress_ms),
        });
      } catch {
        // Network error — if we've tried enough times, mark as connected anyway
        if (attempts > 5) {
          setPlayback({ connected: true, service: 'spotify' });
        }
      }
    };

    // Initial poll
    pollCurrentlyPlaying();

    // Poll every 500ms for smoother position tracking
    pollRef.current = setInterval(pollCurrentlyPlaying, 500);

    // Safety timeout: mark connected after 10s even if no response
    const safetyTimer = setTimeout(() => {
      if (!tokenValid) {
        setPlayback({ connected: true, service: 'spotify' });
      }
    }, 10000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      clearTimeout(safetyTimer);
    };
  }, [token, setPlayback]);

  // Initialize Web Playback SDK as secondary (for active playback if needed)
  useEffect(() => {
    if (!token) return;

    const scriptId = 'spotify-web-playback-sdk';
    if (document.getElementById(scriptId)) return;

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: 'Melofy',
        getOAuthToken: (cb: (t: string) => void) => cb(token),
        volume: 0.5,
      });

      player.addListener('ready', ({ device_id }: { device_id: string }) => {
        console.log('[Melofy] Spotfiy Player ready:', device_id);
        setIsReady(true);
      });

      player.addListener('player_state_changed', (state: any) => {
        if (state && state.track_window?.current_track) {
          const track = state.track_window.current_track;
          setPlayback({
            isPlaying: !state.paused,
            positionMs: state.position,
            track: {
              artist: track.artists.map((a: any) => a.name).join(', '),
              title: track.name,
              album: track.album.name,
              albumArtUrl: track.album.images?.[0]?.url || '',
              durationMs: track.duration_ms,
              service: 'spotify' as MusicService,
            },
          });
        }
      });

      player.connect();
      playerRef.current = player;
    };

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
      }
    };
  }, [token, setPlayback]);

  return { isReady };
}

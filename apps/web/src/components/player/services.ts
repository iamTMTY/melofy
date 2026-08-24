import type { MusicService } from '@/lib/types';

export interface ServiceConfig {
  id: MusicService;
  name: string;
  /** In-app route for the service's playing screen. */
  route: string;
  color: string;
  /** External site opened by the "Open {name}" action. */
  openUrl: string;
}

export const SERVICES: ServiceConfig[] = [
  { id: 'spotify', name: 'Spotify', route: '/playing', color: '#1DB954', openUrl: 'https://open.spotify.com' },
  { id: 'youtube_music', name: 'YouTube Music', route: '/playing', color: '#FF0000', openUrl: 'https://music.youtube.com' },
  { id: 'apple_music', name: 'Apple Music', route: '/apple-music', color: '#FA233B', openUrl: 'https://music.apple.com' },
];

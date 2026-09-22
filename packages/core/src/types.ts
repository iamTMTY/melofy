export type MusicService = 'spotify' | 'apple_music' | 'youtube_music';

export interface TrackMetadata {
  artist: string;
  title: string;
  album: string;
  albumArtUrl: string;
  durationMs: number;
  service: MusicService;
}

export interface LyricLine {
  index: number;
  timeMs: number;
  durationMs: number;
  original: string;
  translated?: string;
}

export interface CachedTranslation {
  hash: string;
  artist: string;
  title: string;
  sourceLanguage: string;
  targetLanguage: string;
  lyrics: LyricLine[];
  createdAt: string;
  updatedAt: string;
  flaggedInaccurate: boolean;
}

export interface TranslationRequest {
  artist: string;
  title: string;
  targetLanguage: string;
  lyrics: LyricLine[];
}

export interface TranslationResponse {
  hash: string;
  lyrics: LyricLine[];
  cached: boolean;
  sourceLanguage: string;
}

export interface PlaybackState {
  track: TrackMetadata | null;
  isPlaying: boolean;
  positionMs: number;
  service: MusicService | null;
  connected: boolean;
}

export type ThemePreset = 'classic' | 'immersive' | 'minimal' | 'amoled';

export type ReadingPriority = 'understand' | 'learn' | 'both';

export interface UserPreferences {
  targetLanguage: string;
  fontSize: 'small' | 'medium' | 'large';
  theme: 'dark' | 'light' | 'system';
  showOriginalLyrics: boolean;
  showRomanization: boolean;
  linkedService: MusicService | null;
  themePreset: ThemePreset;
  readingPriority: ReadingPriority;
}

export interface NowPlaying {
  track: TrackMetadata;
  positionMs: number;
  isPlaying: boolean;
  capturedAt: number;
}

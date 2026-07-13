export interface TrackMetadata {
  artist: string;
  title: string;
  album: string;
  albumArtUrl: string;
  durationMs: number;
  service: MusicService;
}

export type MusicService = 'spotify' | 'apple_music' | 'youtube_music';

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

export interface UserPreferences {
  targetLanguage: string;
  fontSize: 'small' | 'medium' | 'large';
  theme: 'dark' | 'light' | 'system';
  showOriginalLyrics: boolean;
  showRomanization: boolean;
  linkedService: MusicService | null;
}

export const SUPPORTED_LANGUAGES: { code: string; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
];

'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { PlaybackState, TrackMetadata, MusicService, UserPreferences, LyricLine } from '@/lib/types';
import { SUPPORTED_LANGUAGES } from '@/lib/types';
import { track } from '@/lib/analytics/client';

interface MelofyAppState {
  sources: Partial<Record<MusicService, PlaybackState>>;
  activeSource: MusicService | null;
  playback: PlaybackState;
  preferences: UserPreferences;
  translatedLyrics: LyricLine[];
  isLoadingLyrics: boolean;
  isTranslating: boolean;
  translationError: string | null;
  translationErrorCode: string | null;
  activeLineIndex: number;
  translationHash: string | null;
  sourceLanguage: string | null;

  setSourcePlayback: (service: MusicService, state: Partial<PlaybackState>) => void;
  setActiveSource: (service: MusicService | null) => void;
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  setTranslatedLyrics: (lyrics: LyricLine[], hash: string, sourceLanguage: string) => void;
  setStreamingLyrics: (lyrics: LyricLine[], sourceLanguage: string) => void;
  setLoading: (loading: boolean) => void;
  setTranslating: (translating: boolean) => void;
  setTranslationError: (error: string | null, code?: string | null) => void;
  setActiveLineIndex: (index: number) => void;
  clearLyrics: () => void;
}

function detectBrowserLanguage(): string {
  if (typeof window === 'undefined') return 'en';
  const lang = navigator.language || 'en';
  const short = lang.split('-')[0].toLowerCase();
  const supported = SUPPORTED_LANGUAGES.find((l) => l.code === short);
  return supported ? short : 'en';
}

const BASE_PREFERENCES: Omit<UserPreferences, 'targetLanguage'> = {
  fontSize: 'medium',
  theme: 'system',
  showOriginalLyrics: true,
  showRomanization: false,
  linkedService: null,
  themePreset: 'classic',
  readingPriority: 'understand',
};

function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') {
    return { ...BASE_PREFERENCES, targetLanguage: 'en' };
  }

  const defaults: UserPreferences = {
    ...BASE_PREFERENCES,
    targetLanguage: detectBrowserLanguage(),
    fontSize: window.matchMedia('(max-width: 639px)').matches ? 'small' : BASE_PREFERENCES.fontSize,
  };

  try {
    const stored = localStorage.getItem('melofy-preferences');
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch {}

  return defaults;
}

const EMPTY_PLAYBACK: PlaybackState = {
  track: null,
  isPlaying: false,
  positionMs: 0,
  service: null,
  connected: false,
};

const ACTIVE_SOURCE_KEY = 'melofy-active-source';
const VALID_SERVICES: MusicService[] = ['spotify', 'apple_music', 'youtube_music'];

function loadActiveSource(): MusicService | null {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(ACTIVE_SOURCE_KEY);
  return VALID_SERVICES.includes(v as MusicService) ? (v as MusicService) : null;
}

const MelofyContext = createContext<MelofyAppState | null>(null);

export function MelofyProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<Partial<Record<MusicService, PlaybackState>>>({});
  const [activeSource, setActiveSourceState] = useState<MusicService | null>(loadActiveSource);

  const [preferences, setPreferencesState] = useState<UserPreferences>(loadPreferences);
  const [translatedLyrics, setTranslatedLyricsState] = useState<LyricLine[]>([]);
  const [isLoadingLyrics, setLoading] = useState(false);
  const [isTranslating, setTranslating] = useState(false);
  const [translationError, setTranslationErrorState] = useState<string | null>(null);
  const [translationErrorCode, setTranslationErrorCode] = useState<string | null>(null);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  const [translationHash, setTranslationHash] = useState<string | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('melofy-preferences', JSON.stringify(preferences));
    } catch {}
  }, [preferences]);

  useEffect(() => {
    if (preferences.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (preferences.theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    localStorage.setItem('melofy-theme', preferences.theme);
  }, [preferences.theme]);

  const setSourcePlayback = useCallback((service: MusicService, state: Partial<PlaybackState>) => {
    setSources((prev) => ({
      ...prev,
      [service]: { ...EMPTY_PLAYBACK, ...prev[service], ...state, service },
    }));
  }, []);

  const setActiveSource = useCallback((service: MusicService | null) => {
    setActiveSourceState(service);
    try {
      if (service) localStorage.setItem(ACTIVE_SOURCE_KEY, service);
      else localStorage.removeItem(ACTIVE_SOURCE_KEY);
    } catch {}
    if (service) track('source_selected', { service });
  }, []);

  // The active source's playback, or an empty state. Primitive fields (track
  // artist/title, position) stay stable while OTHER sources update, which is what
  // stops the /playing refetch loop when two platforms play at once.
  const playback: PlaybackState = (activeSource && sources[activeSource]) || EMPTY_PLAYBACK;

  const setPreferences = useCallback((prefs: Partial<UserPreferences>) => {
    setPreferencesState((prev) => ({ ...prev, ...prefs }));
  }, []);

  const setTranslationError = useCallback((error: string | null, code: string | null = null) => {
    setTranslationErrorState(error);
    setTranslationErrorCode(error ? code : null);
  }, []);

  const setTranslatedLyrics = useCallback((lyrics: LyricLine[], hash: string, srcLang: string) => {
    setTranslatedLyricsState(lyrics);
    setTranslationHash(hash);
    setSourceLanguage(srcLang);
    setLoading(false);
    setTranslating(false);
  }, []);

  const setStreamingLyrics = useCallback((lyrics: LyricLine[], srcLang: string) => {
    setTranslatedLyricsState(lyrics);
    setSourceLanguage(srcLang);
    setLoading(false);
  }, []);

  const clearLyrics = useCallback(() => {
    setTranslatedLyricsState([]);
    setTranslationHash(null);
    setSourceLanguage(null);
    setActiveLineIndex(-1);
    setLoading(false);
    setTranslating(false);
    setTranslationError(null);
  }, []);

  return (
    <MelofyContext.Provider
      value={{
        sources,
        activeSource,
        playback,
        preferences,
        translatedLyrics,
        isLoadingLyrics,
        isTranslating,
        translationError,
        translationErrorCode,
        activeLineIndex,
        translationHash,
        sourceLanguage,
        setSourcePlayback,
        setActiveSource,
        setPreferences,
        setTranslatedLyrics,
        setStreamingLyrics,
        setLoading,
        setTranslating,
        setTranslationError,
        setActiveLineIndex,
        clearLyrics,
      }}
    >
      {children}
    </MelofyContext.Provider>
  );
}

export function useMelofy() {
  const ctx = useContext(MelofyContext);
  if (!ctx) throw new Error('useMelofy must be used within MelofyProvider');
  return ctx;
}

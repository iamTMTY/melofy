'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { PlaybackState, TrackMetadata, MusicService, UserPreferences, LyricLine } from '@/lib/types';
import { SUPPORTED_LANGUAGES } from '@/lib/types';

interface MelofyAppState {
  playback: PlaybackState;
  preferences: UserPreferences;
  translatedLyrics: LyricLine[];
  isLoadingLyrics: boolean;
  isTranslating: boolean;
  translationError: string | null;
  activeLineIndex: number;
  translationHash: string | null;
  sourceLanguage: string | null;

  setPlayback: (state: Partial<PlaybackState>) => void;
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  setTranslatedLyrics: (lyrics: LyricLine[], hash: string, sourceLanguage: string) => void;
  setLoading: (loading: boolean) => void;
  setTranslating: (translating: boolean) => void;
  setTranslationError: (error: string | null) => void;
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

function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') {
    return {
      targetLanguage: 'en',
      fontSize: 'medium',
      theme: 'system',
      showOriginalLyrics: true,
      showRomanization: false,
      linkedService: null,
    };
  }

  try {
    const stored = localStorage.getItem('melofy-preferences');
    if (stored) return JSON.parse(stored);
  } catch {}

  return {
    targetLanguage: detectBrowserLanguage(),
    fontSize: 'medium',
    theme: 'system',
    showOriginalLyrics: true,
    showRomanization: false,
    linkedService: null,
  };
}

const MelofyContext = createContext<MelofyAppState | null>(null);

export function MelofyProvider({ children }: { children: ReactNode }) {
  const [playback, setPlaybackState] = useState<PlaybackState>({
    track: null,
    isPlaying: false,
    positionMs: 0,
    service: null,
    connected: false,
  });

  const [preferences, setPreferencesState] = useState<UserPreferences>(loadPreferences);
  const [translatedLyrics, setTranslatedLyricsState] = useState<LyricLine[]>([]);
  const [isLoadingLyrics, setLoading] = useState(false);
  const [isTranslating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
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
      // System
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    localStorage.setItem('melofy-theme', preferences.theme);
  }, [preferences.theme]);

  const setPlayback = useCallback((state: Partial<PlaybackState>) => {
    setPlaybackState((prev) => ({ ...prev, ...state }));
  }, []);

  const setPreferences = useCallback((prefs: Partial<UserPreferences>) => {
    setPreferencesState((prev) => ({ ...prev, ...prefs }));
  }, []);

  const setTranslatedLyrics = useCallback((lyrics: LyricLine[], hash: string, srcLang: string) => {
    setTranslatedLyricsState(lyrics);
    setTranslationHash(hash);
    setSourceLanguage(srcLang);
    setLoading(false);
    setTranslating(false);
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
        playback,
        preferences,
        translatedLyrics,
        isLoadingLyrics,
        isTranslating,
        translationError,
        activeLineIndex,
        translationHash,
        sourceLanguage,
        setPlayback,
        setPreferences,
        setTranslatedLyrics,
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

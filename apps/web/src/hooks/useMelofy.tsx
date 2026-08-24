'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { PlaybackState, TrackMetadata, MusicService, UserPreferences, LyricLine } from '@/lib/types';
import { SUPPORTED_LANGUAGES } from '@/lib/types';
import { track } from '@/lib/analytics/client';

interface MelofyAppState {
  /** Per-platform playback snapshots — each connected source updates its OWN slot,
   *  so Spotify and YouTube Music no longer fight over one shared object. */
  sources: Partial<Record<MusicService, PlaybackState>>;
  /** The platform the /playing screen is locked to (persisted across navigation). */
  activeSource: MusicService | null;
  /** Convenience: the active source's playback (or an empty state). */
  playback: PlaybackState;
  preferences: UserPreferences;
  translatedLyrics: LyricLine[];
  isLoadingLyrics: boolean;
  isTranslating: boolean;
  translationError: string | null;
  /** Machine-readable code for the current error, e.g. 'RATE_LIMIT'. */
  translationErrorCode: string | null;
  activeLineIndex: number;
  translationHash: string | null;
  sourceLanguage: string | null;

  /** Merge a partial update into one platform's slot. */
  setSourcePlayback: (service: MusicService, state: Partial<PlaybackState>) => void;
  /** Choose which platform /playing follows (persisted). */
  setActiveSource: (service: MusicService | null) => void;
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  setTranslatedLyrics: (lyrics: LyricLine[], hash: string, sourceLanguage: string) => void;
  /** Progressive update while streaming: sets lyrics without ending the translating state. */
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

  // Progressive update during streaming — keeps `isTranslating` true (so the
  // final-state logic stays intact) while lines populate the view incrementally.
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

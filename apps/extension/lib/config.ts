// Build/Node context (wxt.config, entrypoint analysis) has `process`; the Vite
// runtime bundle does not. Route by context so the runtime branch stays a clean
// `import.meta.env.WXT_MELOFY_ORIGIN` access that Vite statically inlines — a
// cast/optional-chain here silently defeats that inlining (prod would fall back
// to the dev origin).
const ENV_ORIGIN: string | undefined =
  typeof process !== 'undefined' && process.env
    ? process.env.WXT_MELOFY_ORIGIN
    : (import.meta.env as Record<string, string | undefined>).WXT_MELOFY_ORIGIN;

export const MELOFY_WEB_ORIGINS: string[] = ENV_ORIGIN
  ? [ENV_ORIGIN.replace(/\/$/, '')]
  : ['http://localhost:3009', 'http://127.0.0.1:3009'];

export const MELOFY_MATCH_PATTERNS: string[] = MELOFY_WEB_ORIGINS.map((o) => `${o}/*`);

export const MELOFY_API_BASE: string = MELOFY_WEB_ORIGINS[0];

export const DEFAULT_TARGET_LANGUAGE = 'en';

export const NOW_PLAYING_KEY = 'melofy:nowplaying';

export const PREFS_KEY = 'melofy:prefs';

export type FontSize = 'small' | 'medium' | 'large';
export type ReadingPriority = 'understand' | 'learn' | 'both';
export interface Prefs {
  targetLanguage: string;
  autoTranslate: boolean;
  fontSize: FontSize;
  readingPriority: ReadingPriority;
  focusBlur: boolean;
}
export const DEFAULT_PREFS: Prefs = {
  targetLanguage: DEFAULT_TARGET_LANGUAGE,
  autoTranslate: true,
  fontSize: 'medium',
  readingPriority: 'understand',
  focusBlur: false,
};

export const ENABLED_KEY = 'melofy:enabled';
export const translationCacheKey = (
  artist: string,
  title: string,
  lang: string,
  rec?: { album?: string; durationMs?: number }
) => {
  const secs = rec?.durationMs && rec.durationMs > 0 ? Math.round(rec.durationMs / 1000) : '';
  const album = rec?.album ?? '';
  const part = !album && secs === '' ? '' : ` ${album} ${secs}`;
  return `melofy:tr:${artist} ${title} ${lang}${part}`.toLowerCase();
};

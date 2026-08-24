// ---------------------------------------------------------------------------
// Melofy web origin — the single source of truth.
//
// Used in three places that must agree: the background fetch base URL, the
// manifest host_permissions (wxt.config.ts), and the bridge content-script
// `matches` (melofy-bridge.content.ts). Override for production with the
// WXT_MELOFY_ORIGIN env var at build time, e.g.:
//
//   WXT_MELOFY_ORIGIN=https://melofy.app pnpm --filter @melofy/extension build
//
// Reads process.env (build/Node context: wxt.config + entrypoint analysis) and
// import.meta.env (Vite-inlined into the runtime bundle); the guards let the
// same module work in both without crashing.
// ---------------------------------------------------------------------------
// Build/Node context (wxt.config, entrypoint analysis) has `process`; the Vite
// runtime bundle does not. Route by context so the runtime branch stays a clean
// `import.meta.env.WXT_MELOFY_ORIGIN` access that Vite statically inlines — a
// cast/optional-chain here silently defeats that inlining (prod would fall back
// to the dev origin).
const ENV_ORIGIN: string | undefined =
  typeof process !== 'undefined' && process.env
    ? process.env.WXT_MELOFY_ORIGIN
    : (import.meta.env as Record<string, string | undefined>).WXT_MELOFY_ORIGIN;

/** Origins the Melofy web app is served from. Prod = one; dev = localhost pair. */
export const MELOFY_WEB_ORIGINS: string[] = ENV_ORIGIN
  ? [ENV_ORIGIN.replace(/\/$/, '')]
  : ['http://localhost:3009', 'http://127.0.0.1:3009'];

/** `<origin>/*` patterns for host_permissions and content-script matches. */
export const MELOFY_MATCH_PATTERNS: string[] = MELOFY_WEB_ORIGINS.map((o) => `${o}/*`);

/** Base URL the background worker calls for translation. */
export const MELOFY_API_BASE: string = MELOFY_WEB_ORIGINS[0];

export const DEFAULT_TARGET_LANGUAGE = 'en';

/** Storage key for the latest now-playing snapshot (written by the YTM content
 * script; read by the popup and the web-bridge content script). */
export const NOW_PLAYING_KEY = 'melofy:nowplaying';

// Persisted UI prefs + per-track translation cache live under these keys.
export const PREFS_KEY = 'melofy:prefs';

/** Master on/off for the on-page widget, toggled from the popup. Absent = on
 *  (default), so first-run behavior is unchanged. When false, the content script
 *  unmounts the widget entirely (FAB + panel gone) until re-enabled. */
export const ENABLED_KEY = 'melofy:enabled';
export const translationCacheKey = (artist: string, title: string, lang: string) =>
  `melofy:tr:${artist} ${title} ${lang}`.toLowerCase();

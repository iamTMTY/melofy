// Client-side helpers for the persisted Spotify connection.
//
// A connection is "remembered" via localStorage tokens written by the OAuth
// callback. These helpers centralize reading that state so the UI can reflect a
// prior connection immediately (auto-connect) and never kick off a fresh OAuth
// redirect when the user is already connected.

const ACCESS_TOKEN_KEY = 'melofy-spotify-access-token';
const REFRESH_TOKEN_KEY = 'melofy-spotify-refresh-token';
const EXPIRES_AT_KEY = 'melofy-spotify-expires-at';

/** True if the user has connected Spotify before (a usable or refreshable token exists). */
export function hasSpotifyConnection(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    !!localStorage.getItem(ACCESS_TOKEN_KEY) || !!localStorage.getItem(REFRESH_TOKEN_KEY)
  );
}

/** The stored access token if it's still valid; otherwise null (caller should refresh). */
export function getValidSpotifyToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const expiresAt = localStorage.getItem(EXPIRES_AT_KEY);
  if (token && expiresAt && Date.now() < parseInt(expiresAt, 10)) return token;
  return null;
}

/**
 * Start the Spotify OAuth flow — but ONLY if there's no remembered connection.
 * Returns true if it redirected to Spotify, false if it was skipped because the
 * user is already connected. Callers can use the return value to fall back to
 * the connected experience instead of redirecting.
 */
export function startSpotifyConnect(): boolean {
  if (hasSpotifyConnection()) return false;
  window.location.href = '/api/auth/spotify/callback';
  return true;
}

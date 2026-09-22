
const ACCESS_TOKEN_KEY = 'melofy-spotify-access-token';
const REFRESH_TOKEN_KEY = 'melofy-spotify-refresh-token';
const EXPIRES_AT_KEY = 'melofy-spotify-expires-at';

export function hasSpotifyConnection(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    !!localStorage.getItem(ACCESS_TOKEN_KEY) || !!localStorage.getItem(REFRESH_TOKEN_KEY)
  );
}

export function getValidSpotifyToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const expiresAt = localStorage.getItem(EXPIRES_AT_KEY);
  if (token && expiresAt && Date.now() < parseInt(expiresAt, 10)) return token;
  return null;
}

export function startSpotifyConnect(): boolean {
  if (hasSpotifyConnection()) return false;
  window.location.href = '/api/auth/spotify/callback';
  return true;
}

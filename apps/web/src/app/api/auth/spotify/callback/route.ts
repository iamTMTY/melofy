import { NextRequest, NextResponse } from 'next/server';

const SPOTIFY_CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || '';
const REDIRECT_URI = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:3009/api/auth/spotify/callback';
// Public origin to send the browser back to. Behind a reverse proxy (Traefik),
// `req.url` resolves to the container's internal host (localhost:3009), so we
// derive the real origin from the configured redirect URI instead.
const APP_ORIGIN = (() => {
  try {
    return new URL(REDIRECT_URI).origin;
  } catch {
    return 'http://127.0.0.1:3009';
  }
})();
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-read-currently-playing',
  'user-modify-playback-state',
].join(' ');

function generateCodeVerifier(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    result += charset[array[i] % charset.length];
  }
  return result;
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${error}`, APP_ORIGIN));
  }

  if (!code) {
    const codeVerifier = generateCodeVerifier(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const params = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      scope: SCOPES,
      state: codeVerifier,
    });

    const redirectResponse = NextResponse.redirect(
      `https://accounts.spotify.com/authorize?${params.toString()}`
    );

    return redirectResponse;
  }

  // Exchange authorization code for tokens
  const codeVerifier = state || '';

  try {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokens = await tokenResponse.json();

    // Redirect back to the app with tokens in the query string.
    const callbackUrl = new URL('/', APP_ORIGIN);
    callbackUrl.searchParams.set('spotify_connected', 'true');
    callbackUrl.searchParams.set('access_token', tokens.access_token);
    callbackUrl.searchParams.set('refresh_token', tokens.refresh_token || '');
    callbackUrl.searchParams.set('expires_in', String(tokens.expires_in || 3600));

    return NextResponse.redirect(callbackUrl);
  } catch (err) {
    console.error('[Spotify Auth] Token exchange error:', err);
    return NextResponse.redirect(new URL('/?error=token_exchange_failed', APP_ORIGIN));
  }
}

import { NextRequest, NextResponse } from 'next/server';

const SPOTIFY_CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || '';

export async function POST(req: NextRequest) {
  try {
    const { refresh_token } = await req.json();

    if (!refresh_token) {
      return NextResponse.json({ error: 'refresh_token required' }, { status: 400 });
    }

    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token,
      }),
    });

    if (!tokenResponse.ok) {
      return NextResponse.json({ error: 'Refresh failed' }, { status: 401 });
    }

    const data = await tokenResponse.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

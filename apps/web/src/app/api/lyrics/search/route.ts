import { NextRequest, NextResponse } from 'next/server';
import { fetchLyrics } from '@/lib/services/lyrics';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, { bucket: 'lyrics', limit: 60, windowSec: 60 });
  if (limited) return limited;

  try {
    const { searchParams } = new URL(req.url);
    const artist = searchParams.get('artist');
    const title = searchParams.get('title');
    const durationMs = Number(searchParams.get('durationMs')) || undefined;
    const album = searchParams.get('album') || undefined;

    if (!artist || !title) {
      return NextResponse.json(
        { error: 'Artist and title are required' },
        { status: 400 }
      );
    }

    const { lines, synced } = await fetchLyrics(artist, title, durationMs, album);

    if (lines.length === 0) {
      return NextResponse.json(
        { error: 'No lyrics found for this track', code: 'NO_LYRICS' },
        { status: 404 }
      );
    }

    // Words without timings can't drive the highlight, and inventing timings makes
    // the whole view wrong. Say so instead.
    if (!synced) {
      return NextResponse.json(
        { error: "I found lyrics for this track, but they aren't synced.", code: 'NOT_SYNCED' },
        { status: 422 }
      );
    }

    return NextResponse.json({ lyrics: lines });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch lyrics' },
      { status: 500 }
    );
  }
}

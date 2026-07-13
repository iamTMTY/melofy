import { NextRequest, NextResponse } from 'next/server';
import { fetchLyrics } from '@/lib/services/lyrics';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const artist = searchParams.get('artist');
    const title = searchParams.get('title');

    if (!artist || !title) {
      return NextResponse.json(
        { error: 'Artist and title are required' },
        { status: 400 }
      );
    }

    const lyrics = await fetchLyrics(artist, title);

    if (lyrics.length === 0) {
      return NextResponse.json(
        { error: 'No lyrics found for this track' },
        { status: 404 }
      );
    }

    return NextResponse.json({ lyrics });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch lyrics' },
      { status: 500 }
    );
  }
}

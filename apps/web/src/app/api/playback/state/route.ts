import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, { bucket: 'playback', limit: 120, windowSec: 60 });
  if (limited) return limited;

  try {
    const { track, isPlaying, positionMs, service } = await req.json();

    return NextResponse.json({
      received: true,
      track,
      isPlaying,
      positionMs,
      service,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

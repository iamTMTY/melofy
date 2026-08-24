import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
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

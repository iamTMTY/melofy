import { NextRequest, NextResponse } from 'next/server';
import { flagTranslationInaccurate } from '@/lib/services/cache';
import { connectMongoDB } from '@/lib/db/mongodb';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, { bucket: 'flag', limit: 20, windowSec: 60 });
  if (limited) return limited;

  try {
    const { hash } = await req.json();
    if (!hash || typeof hash !== 'string') {
      return NextResponse.json({ error: 'Hash is required' }, { status: 400 });
    }

    await connectMongoDB();

    await flagTranslationInaccurate(hash);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to flag translation' },
      { status: 500 }
    );
  }
}

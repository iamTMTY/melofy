import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/rate-limit';
import { captureServer } from '@/lib/analytics/server';

const Schema = z.object({
  event: z.string().min(1).max(64),
  distinctId: z.string().min(1).max(200),
  properties: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, { bucket: 'analytics', limit: 120, windowSec: 60 });
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { event, distinctId, properties } = parsed.data;

  await captureServer({
    distinctId: `ext_${distinctId}`,
    event,
    properties: { ...properties, surface: 'extension' },
  });

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { captureServer } from '@/lib/analytics/server';

/**
 * Analytics sink for the browser extension's UI events (widget opened, popup
 * opened, key configured, …). The extension can't ship the PostHog SDK cleanly
 * under MV3 (no remote code) and we'd rather not embed a PostHog key + host
 * permission in it — so it forwards events here and the server captures them,
 * reusing the exact same pipeline as the translation events. Ad-blocker-proof
 * and schema-consistent with the rest of our analytics.
 *
 * Called from the extension background worker (host permission ⇒ no CORS). The
 * distinctId is a random per-install id the extension generates and stores; we
 * namespace it so extension installs never collide with the web's hashed-IP ids.
 */
const Schema = z.object({
  event: z.string().min(1).max(64),
  distinctId: z.string().min(1).max(200),
  properties: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
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

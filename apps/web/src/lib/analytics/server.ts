import 'server-only';
import { PostHog } from 'posthog-node';
import type { NextRequest } from 'next/server';
import { config } from '@/lib/config';
import { anonymousId } from '@/lib/rate-limit';

let client: PostHog | null = null;
const disabled = !config.posthogKey;

function getClient(): PostHog | null {
  if (disabled) return null;
  if (!client) {
    client = new PostHog(config.posthogKey, {
      host: config.posthogHost,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

export type ServerEvent =
  | 'translation_completed'
  | 'translation_failed'
  | 'rate_limit_hit'
  | 'byok_used'
  | 'extension_event';

export type Surface = 'web' | 'extension';

export interface CaptureOptions {
  distinctId: string;
  event: ServerEvent | string;
  properties?: Record<string, unknown>;
}

export async function captureServer({ distinctId, event, properties }: CaptureOptions): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    await c.captureImmediate({ distinctId, event, properties });
  } catch {}
}

export async function captureFromRequest(
  req: NextRequest,
  event: ServerEvent | string,
  properties?: Record<string, unknown>
): Promise<void> {
  return captureServer({ distinctId: anonymousId(req), event, properties });
}

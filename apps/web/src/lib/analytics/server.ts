import 'server-only';
import { PostHog } from 'posthog-node';
import type { NextRequest } from 'next/server';
import { config } from '@/lib/config';
import { anonymousId } from '@/lib/rate-limit';

// Server-side product analytics. This is the reliable, ad-blocker-proof path for
// the events that matter most (translations, rate limits) — captured identically
// for BOTH the web app and the extension, distinguished by a `surface` property.
// Anonymous by design: the distinctId is the same hashed-IP the rate limiter uses
// (see anonymousId), never a raw IP or account.
//
// No-op unless POSTHOG_KEY (or NEXT_PUBLIC_POSTHOG_KEY) is set.

let client: PostHog | null = null;
const disabled = !config.posthogKey;

function getClient(): PostHog | null {
  if (disabled) return null;
  if (!client) {
    // flushAt/flushInterval tuned for request-scoped use: send eagerly rather
    // than batching across a long-lived queue we can't rely on flushing.
    client = new PostHog(config.posthogKey, {
      host: config.posthogHost,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

/** Event names — one place so web + extension can't drift on spelling. */
export type ServerEvent =
  | 'translation_completed'
  | 'translation_failed'
  | 'rate_limit_hit'
  | 'byok_used'
  | 'extension_event'; // pass-through wrapper for UI events forwarded by the extension

export type Surface = 'web' | 'extension';

export interface CaptureOptions {
  distinctId: string;
  event: ServerEvent | string;
  properties?: Record<string, unknown>;
}

/**
 * Capture one event. Uses captureImmediate (awaits the HTTP send) so events
 * aren't lost if the runtime freezes the process after the response — the
 * serverless-safe pattern. Errors are swallowed: analytics never breaks a route.
 */
export async function captureServer({ distinctId, event, properties }: CaptureOptions): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    await c.captureImmediate({ distinctId, event, properties });
  } catch {
    /* analytics is best-effort */
  }
}

/** Convenience: derive the anonymous distinctId from the request and capture. */
export async function captureFromRequest(
  req: NextRequest,
  event: ServerEvent | string,
  properties?: Record<string, unknown>
): Promise<void> {
  return captureServer({ distinctId: anonymousId(req), event, properties });
}

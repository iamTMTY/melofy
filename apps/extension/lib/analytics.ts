import { MELOFY_API_BASE } from './config';
import type { TrackReq } from './messages';

// Lightweight, privacy-conscious analytics for the extension. UI events are
// forwarded to the Melofy web app (/api/analytics/event), which captures them in
// PostHog server-side — so no PostHog key or extra host permission ships in the
// extension, and events survive ad-blockers. Translation events are already
// captured server-side by the translate route; this covers UI-only events.
//
// The actual network send happens in the BACKGROUND worker (sendTrackEvent),
// which holds host permissions and so reaches the API without page CORS. UI code
// (popup + content-script widget) calls track(), which just messages background.

const ANON_ID_KEY = 'melofy:anon-id';

/** Called from UI contexts (popup, content script). Fire-and-forget. */
export function track(event: string, properties?: Record<string, unknown>): void {
  try {
    void browser.runtime.sendMessage({ type: 'TRACK', event, properties } satisfies TrackReq);
  } catch {
    /* best-effort */
  }
}

async function getAnonId(): Promise<string> {
  const r = await browser.storage.local.get(ANON_ID_KEY);
  let id = r[ANON_ID_KEY] as string | undefined;
  if (!id) {
    id = crypto.randomUUID();
    await browser.storage.local.set({ [ANON_ID_KEY]: id });
  }
  return id;
}

/** Runs in the BACKGROUND worker: performs the actual cross-origin send. */
export async function sendTrackEvent(msg: TrackReq): Promise<void> {
  try {
    const distinctId = await getAnonId();
    await fetch(`${MELOFY_API_BASE}/api/analytics/event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: msg.event, distinctId, properties: msg.properties }),
      keepalive: true,
    });
  } catch {
    /* best-effort */
  }
}

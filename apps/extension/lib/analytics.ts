import { MELOFY_API_BASE } from './config';
import type { TrackReq } from './messages';

const ANON_ID_KEY = 'melofy:anon-id';

export function track(event: string, properties?: Record<string, unknown>): void {
  try {
    void browser.runtime.sendMessage({ type: 'TRACK', event, properties } satisfies TrackReq);
  } catch {}
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

export async function sendTrackEvent(msg: TrackReq): Promise<void> {
  try {
    const distinctId = await getAnonId();
    await fetch(`${MELOFY_API_BASE}/api/analytics/event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: msg.event, distinctId, properties: msg.properties }),
      keepalive: true,
    });
  } catch {}
}

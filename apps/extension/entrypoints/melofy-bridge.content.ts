import type { NowPlaying } from '@melofy/core';
import { MELOFY_MATCH_PATTERNS, NOW_PLAYING_KEY } from '../lib/config';

// Runs on the Melofy WEB app origin. Bridges the extension's now-playing state
// (written by the YouTube Music content script into shared storage) to the page
// via window.postMessage — so the web app can use the extension as its YTM
// now-playing provider without needing the extension's ID.
//
// Origins come from lib/config (WXT_MELOFY_ORIGIN for prod).
const SOURCE = 'melofy-extension';

export default defineContentScript({
  matches: MELOFY_MATCH_PATTERNS,
  runAt: 'document_start',
  main() {
    const post = (msg: Record<string, unknown>) =>
      window.postMessage({ source: SOURCE, ...msg }, window.location.origin);

    const sendCurrent = async () => {
      const r = await browser.storage.local.get(NOW_PLAYING_KEY);
      const np = r[NOW_PLAYING_KEY] as NowPlaying | undefined;
      if (np) post({ type: 'NOW_PLAYING', nowPlaying: np });
    };

    // Announce presence + current state immediately…
    post({ type: 'READY' });
    void sendCurrent();

    // …and forward every update as the YTM tab writes it.
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[NOW_PLAYING_KEY]) return;
      const np = changes[NOW_PLAYING_KEY].newValue as NowPlaying | undefined;
      if (np) post({ type: 'NOW_PLAYING', nowPlaying: np });
    });

    // The web app may mount after our READY — answer its request for state.
    window.addEventListener('message', (e) => {
      if (e.source !== window) return;
      const data = e.data as { source?: string; type?: string } | undefined;
      if (data?.source !== 'melofy-web' || data.type !== 'REQUEST_NOW_PLAYING') return;
      post({ type: 'READY' });
      void sendCurrent();
    });
  },
});

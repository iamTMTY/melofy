import type { NowPlaying } from '@melofy/core';
import { MELOFY_MATCH_PATTERNS, NOW_PLAYING_KEY } from '../lib/config';

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

    post({ type: 'READY' });
    void sendCurrent();

    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[NOW_PLAYING_KEY]) return;
      const np = changes[NOW_PLAYING_KEY].newValue as NowPlaying | undefined;
      if (np) post({ type: 'NOW_PLAYING', nowPlaying: np });
    });

    window.addEventListener('message', (e) => {
      if (e.source !== window) return;
      const data = e.data as { source?: string; type?: string } | undefined;
      if (data?.source !== 'melofy-web' || data.type !== 'REQUEST_NOW_PLAYING') return;
      post({ type: 'READY' });
      void sendCurrent();
    });
  },
});

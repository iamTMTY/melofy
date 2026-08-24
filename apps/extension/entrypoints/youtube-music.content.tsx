import { createRoot, type Root } from 'react-dom/client';
import { NOW_PLAYING_KEY, watchNowPlaying } from '../lib/nowplaying';
import { ENABLED_KEY } from '../lib/config';
import { LyricsWidget } from '../components/LyricsWidget';

// Runs on YouTube Music: (1) keeps the popup / future web bridge fed with the
// current track, and (2) mounts the translated-lyrics widget in a shadow root so
// the page's CSS can't touch it (and vice versa).
export default defineContentScript({
  matches: ['*://music.youtube.com/*'],
  cssInjectionMode: 'ui',
  runAt: 'document_idle',
  async main(ctx) {
    console.log('[Melofy] content script loaded on YouTube Music');

    const stop = watchNowPlaying({
      onChange: (np) => {
        console.log('[Melofy] now playing:', `${np.track.artist} — ${np.track.title}`);
        void browser.storage.local.set({ [NOW_PLAYING_KEY]: np });
      },
      onTick: (np) => {
        void browser.storage.local.set({ [NOW_PLAYING_KEY]: np });
      },
    });
    ctx.onInvalidated(stop);

    const ui = await createShadowRootUi<Root>(ctx, {
      name: 'melofy-lyrics',
      position: 'inline',
      anchor: 'body',
      onMount: (container) => {
        const root = createRoot(container);
        root.render(<LyricsWidget />);
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });

    // The widget is mounted/unmounted based on the popup's on/off toggle
    // (ENABLED_KEY). Default is ON so first-run behavior is unchanged; turning it
    // off removes the FAB + panel from the page entirely until re-enabled. The
    // now-playing watcher above keeps running regardless, so the popup still works.
    let mounted = false;
    const syncMount = async () => {
      const r = await browser.storage.local.get(ENABLED_KEY);
      const enabled = (r[ENABLED_KEY] as boolean | undefined) ?? true;
      if (enabled && !mounted) {
        ui.mount();
        mounted = true;
      } else if (!enabled && mounted) {
        ui.remove();
        mounted = false;
      }
    };
    await syncMount();

    const onStorageChange = (changes: Record<string, unknown>, area: string) => {
      if (area === 'local' && ENABLED_KEY in changes) void syncMount();
    };
    browser.storage.onChanged.addListener(onStorageChange);
    ctx.onInvalidated(() => browser.storage.onChanged.removeListener(onStorageChange));
  },
});

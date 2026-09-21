import { createRoot, type Root } from 'react-dom/client';
import { NOW_PLAYING_KEY, watchNowPlaying } from '../lib/nowplaying';
import { ENABLED_KEY } from '../lib/config';
import { LyricsView } from '../components/LyricsView';

// ponytail: YouTube Music's lyrics-tab DOM is the calibration knob. If YTM moves
// or renames the tab, THIS is the only function to adjust — the rest is DOM-
// agnostic. Verify selectors against a live music.youtube.com page.
// Returns the container to render into ONLY when the Lyrics tab is the active one.
function findLyricsMount(): HTMLElement | null {
  const page = document.querySelector('ytmusic-player-page');
  if (!page) return null;
  const lyricsTab = Array.from(page.querySelectorAll<HTMLElement>('tp-yt-paper-tab')).find((t) =>
    /lyric/i.test(t.textContent || '')
  );
  if (!lyricsTab) return null;
  const active =
    lyricsTab.getAttribute('aria-selected') === 'true' || lyricsTab.classList.contains('iron-selected');
  if (!active) return null;
  return page.querySelector<HTMLElement>('#tab-renderer');
}

export default defineContentScript({
  matches: ['*://music.youtube.com/*'],
  cssInjectionMode: 'ui',
  runAt: 'document_idle',
  async main(ctx) {
    // Keep the popup / web bridge fed with the current track.
    const stop = watchNowPlaying({
      onChange: (np) => void browser.storage.local.set({ [NOW_PLAYING_KEY]: np }),
      onTick: (np) => void browser.storage.local.set({ [NOW_PLAYING_KEY]: np }),
    });
    ctx.onInvalidated(stop);

    const ui = await createShadowRootUi<Root>(ctx, {
      name: 'melofy-lyrics',
      position: 'inline',
      anchor: () => findLyricsMount() ?? undefined,
      append: 'last',
      onMount: (container) => {
        const root = createRoot(container);
        root.render(<LyricsView />);
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });

    // We ui.mount() ONCE, then just move the host in/out of the lyrics tab. The
    // React root (and its fetched lyrics/translation) is never torn down on a tab
    // switch, so returning to the tab is instant — no "Loading lyrics…" reload.
    let created = false;
    let hidden: HTMLElement[] = [];
    const hideNative = (container: HTMLElement) => {
      for (const el of Array.from(container.children)) {
        if (el === ui.shadowHost || !(el instanceof HTMLElement)) continue;
        if (el.style.display !== 'none') {
          hidden.push(el);
          el.style.display = 'none';
        }
      }
    };
    const restoreNative = () => {
      // Elements YTM has since discarded are harmless to touch; the list is
      // always emptied so a stale reference can never keep a node hidden.
      for (const el of hidden) el.style.display = '';
      hidden = [];
    };

    // Poll catches tab switches + track changes (no DOM events for those); the
    // storage listener catches the popup's on/off toggle.
    const sync = async () => {
      const r = await browser.storage.local.get(ENABLED_KEY);
      const enabled = (r[ENABLED_KEY] as boolean | undefined) ?? true;
      const container = findLyricsMount();
      const want = enabled && !!container;

      if (!want) {
        // Lyrics tab inactive (or disabled): pull our view out, restore native.
        // The React root stays alive (not unmounted) so its state is preserved.
        if (created) {
          // Restore FIRST and unconditionally: if YTM tore out our host on its
          // own, `isConnected` is already false, and gating on it would leave
          // the native lyrics stuck at display:none — a blank tab.
          restoreNative();
          if (ui.shadowHost.isConnected) ui.shadowHost.remove();
        }
        return;
      }

      if (!created) {
        ui.mount(); // creates the React root once
        ui.shadowHost.style.cssText = 'display:block;height:100%;';
        created = true;
      } else if (ui.shadowHost.parentElement !== container) {
        // Re-attach the SAME host (YTM re-rendered the tab). No remount → no reload.
        restoreNative();
        container!.appendChild(ui.shadowHost);
      }
      hideNative(container!); // keep native lyrics hidden as YTM lazy-loads them
    };

    await sync();
    const poll = window.setInterval(sync, 700);
    ctx.onInvalidated(() => window.clearInterval(poll));

    const onStorage = (changes: Record<string, unknown>, area: string) => {
      if (area === 'local' && ENABLED_KEY in changes) void sync();
    };
    browser.storage.onChanged.addListener(onStorage);
    ctx.onInvalidated(() => browser.storage.onChanged.removeListener(onStorage));
  },
});

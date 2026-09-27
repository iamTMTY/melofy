import { createRoot, type Root } from 'react-dom/client';
import type { NowPlaying } from '@melofy/core';
import { NOW_PLAYING_KEY, watchNowPlaying } from '../lib/nowplaying';
import { ENABLED_KEY } from '../lib/config';
import { LyricsView } from '../components/LyricsView';

// YouTube Music's player-page DOM is undocumented. Keep its selectors here so
// a YTM redesign has one place to fix, and leave the native tabs usable if it
// no longer matches.
function playerParts() {
  const page = document.querySelector<HTMLElement>('ytmusic-player-page');
  const sidebar = page?.querySelector<HTMLElement>('#side-panel');
  const tabs = sidebar?.querySelector<HTMLElement>('tp-yt-paper-tabs');
  const renderer = sidebar?.querySelector<HTMLElement>('#tab-renderer');
  const lyricsTab = Array.from(tabs?.querySelectorAll<HTMLElement>('tp-yt-paper-tab') ?? [])
    .find((tab) => /lyric/i.test(tab.textContent ?? ''));
  const lyricsActive = !!lyricsTab && (
    lyricsTab.getAttribute('aria-selected') === 'true' || lyricsTab.classList.contains('iron-selected')
  );
  return { page, sidebar, tabs, renderer, lyricsTab, lyricsActive };
}

const pageStyle = `
  ytmusic-player-page #tab-renderer.melofy-lyrics-active {
    position: relative !important;
    overflow: hidden !important;
    min-height: min(50dvh, 480px) !important;
  }
  ytmusic-player-page #tab-renderer.melofy-lyrics-active > :not(melofy-lyrics) {
    display: none !important;
  }
  .melofy-fullscreen-button {
    position: fixed; right: 16px; bottom: 16px; z-index: 20;
    display: grid; place-items: center; width: 34px; height: 34px;
    border: 1px solid rgba(255,255,255,.22); border-radius: 8px;
    background: rgba(28,28,32,.88); color: #f4f5fa; cursor: pointer;
    box-shadow: 0 2px 12px rgba(0,0,0,.22);
  }
  .melofy-fullscreen-button:hover { background: #39393f; }
  .melofy-fullscreen-button:focus-visible { outline: 2px solid #a78bfa; outline-offset: 2px; }
  .melofy-fullscreen-button[hidden] { display: none !important; }
  .melofy-fullscreen-button svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  html.melofy-fullscreen ytmusic-player-page {
    z-index: 6 !important;
  }
  html.melofy-fullscreen ytmusic-player-bar {
    z-index: 7 !important;
  }
  html.melofy-fullscreen ytmusic-player-page #side-panel {
    position: fixed !important;
    top: calc(-1 * var(--melofy-page-top, 0px)) !important;
    left: calc(-1 * var(--melofy-page-left, 0px)) !important;
    right: auto !important;
    bottom: auto !important;
    width: 100vw !important;
    max-width: none !important;
    height: calc(100dvh - var(--melofy-player-bar-height, 72px)) !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    background: #030304 !important;
    z-index: 1 !important;
  }
  html.melofy-fullscreen ytmusic-player-page #side-panel > #tab-renderer {
    min-height: 0 !important;
  }
`;

export default defineContentScript({
  matches: ['*://music.youtube.com/*'],
  cssInjectionMode: 'ui',
  runAt: 'document_idle',
  async main(ctx) {
    let stopWatching: (() => void) | undefined;
    let contextInvalidated = false;
    const onStorageError = (error: unknown) => {
      if (/Extension context invalidated/i.test(String(error))) {
        contextInvalidated = true;
        stopWatching?.();
      } else {
        console.error('[Melofy] Could not save now-playing state:', error);
      }
    };
    const saveNowPlaying = (np: NowPlaying) => {
      if (contextInvalidated) return;
      try {
        void browser.storage.local.set({ [NOW_PLAYING_KEY]: np }).catch(onStorageError);
      } catch (error) {
        onStorageError(error);
      }
    };
    stopWatching = watchNowPlaying({
      onTick: saveNowPlaying,
    });
    if (contextInvalidated) stopWatching();
    ctx.onInvalidated(() => { contextInvalidated = true; stopWatching?.(); });

    const style = document.createElement('style');
    style.textContent = pageStyle;
    document.head.appendChild(style);
    ctx.onInvalidated(() => style.remove());

    const ui = await createShadowRootUi<Root>(ctx, {
      name: 'melofy-lyrics',
      position: 'inline',
      anchor: () => playerParts().renderer ?? undefined,
      append: 'last',
      onMount: (container) => {
        const root = createRoot(container);
        root.render(<LyricsView />);
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });

    let enabled = true;
    let created = false;
    let observedTabs: HTMLElement | null = null;
    let observedRenderer: HTMLElement | null = null;
    let sidebar: HTMLElement | null = null;
    let fullscreenButton: HTMLButtonElement | null = null;
    let expanded = false;
    const tabObserver = new MutationObserver(() => sync());
    const rendererObserver = new MutationObserver(() => sync());

    const updateFullscreen = () => {
      document.documentElement.classList.toggle('melofy-fullscreen', expanded);
      const page = playerParts().page?.getBoundingClientRect();
      document.documentElement.style.setProperty('--melofy-page-top', `${page?.top ?? 0}px`);
      document.documentElement.style.setProperty('--melofy-page-left', `${page?.left ?? 0}px`);
      const barHeight = document.querySelector('ytmusic-player-bar')?.getBoundingClientRect().height || 72;
      document.documentElement.style.setProperty('--melofy-player-bar-height', `${barHeight}px`);
      if (created) ui.shadowHost.toggleAttribute('data-fullscreen', expanded);
      if (fullscreenButton) {
        fullscreenButton.setAttribute('aria-label', expanded ? 'Exit lyrics fullscreen' : 'Expand lyrics and tabs');
        fullscreenButton.setAttribute('aria-pressed', String(expanded));
        fullscreenButton.setAttribute('title', expanded ? 'Exit fullscreen' : 'Fullscreen lyrics and tabs');
        fullscreenButton.innerHTML = expanded
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3v6H3m12-6v6h6M3 15h6v6m12-6h-6v6"/></svg>'
          : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/></svg>';
      }
    };

    const toggleFullscreen = () => {
      expanded = !expanded;
      updateFullscreen();
      sync();
    };

    const sync = () => {
      const parts = playerParts();
      if (parts.tabs !== observedTabs) {
        tabObserver.disconnect();
        observedTabs = parts.tabs ?? null;
        if (observedTabs) {
          tabObserver.observe(observedTabs, {
            subtree: true, attributes: true, attributeFilter: ['aria-selected', 'class'],
          });
        }
      }
      if (parts.renderer !== observedRenderer) {
        rendererObserver.disconnect();
        observedRenderer?.classList.remove('melofy-lyrics-active');
        observedRenderer = parts.renderer ?? null;
        if (observedRenderer) rendererObserver.observe(observedRenderer, { childList: true });
      }

      if (parts.sidebar !== sidebar) {
        sidebar = parts.sidebar ?? null;
        fullscreenButton?.remove();
        fullscreenButton = null;
        if (sidebar) {
          fullscreenButton = document.createElement('button');
          fullscreenButton.type = 'button';
          fullscreenButton.className = 'melofy-fullscreen-button';
          fullscreenButton.addEventListener('click', toggleFullscreen);
          sidebar.appendChild(fullscreenButton);
          updateFullscreen();
        }
      }

      if (!sidebar || !parts.renderer || !parts.lyricsTab || !enabled) {
        parts.renderer?.classList.remove('melofy-lyrics-active');
        if (created) ui.shadowHost.hidden = true;
        if (fullscreenButton) fullscreenButton.hidden = true;
        if (expanded) {
          expanded = false;
          updateFullscreen();
        }
        return;
      }

      // Leave YTM's tabs and renderer in place. Only swap the renderer's lyrics
      // contents; the React root remains mounted across tab switches.
      const showLyrics = parts.lyricsActive;
      if (showLyrics && !created) {
        parts.renderer.classList.add('melofy-lyrics-active');
        ui.mount();
        created = true;
      }
      if (created && ui.shadowHost.parentElement !== parts.renderer) parts.renderer.appendChild(ui.shadowHost);
      if (created) ui.shadowHost.hidden = !showLyrics;
      parts.renderer.classList.toggle('melofy-lyrics-active', showLyrics);
      if (fullscreenButton) fullscreenButton.hidden = !showLyrics && !expanded;
    };

    // Hide native lyrics at the start of a Lyrics click, before YTM paints its
    // own content. The tab observer also handles keyboard and programmatic tabs.
    const onTabClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const tab = target.closest('tp-yt-paper-tab');
      if (tab && /lyric/i.test(tab.textContent ?? '') && enabled) {
        playerParts().renderer?.classList.add('melofy-lyrics-active');
      }
      if (tab) requestAnimationFrame(sync);
    };
    document.addEventListener('click', onTabClick, true);
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && expanded) {
        event.preventDefault();
        event.stopPropagation();
        toggleFullscreen();
      }
    };
    document.addEventListener('keydown', onEscape, true);
    window.addEventListener('resize', updateFullscreen);
    ctx.onInvalidated(() => {
      document.removeEventListener('click', onTabClick, true);
      document.removeEventListener('keydown', onEscape, true);
      window.removeEventListener('resize', updateFullscreen);
      tabObserver.disconnect();
      rendererObserver.disconnect();
      observedRenderer?.classList.remove('melofy-lyrics-active');
      fullscreenButton?.remove();
      document.documentElement.classList.remove('melofy-fullscreen');
      document.documentElement.style.removeProperty('--melofy-player-bar-height');
      document.documentElement.style.removeProperty('--melofy-page-top');
      document.documentElement.style.removeProperty('--melofy-page-left');
    });

    sync();
    void browser.storage.local.get(ENABLED_KEY).then((result) => {
      enabled = (result[ENABLED_KEY] as boolean | undefined) ?? true;
      sync();
    }).catch(onStorageError);
    const poll = window.setInterval(sync, 700);
    ctx.onInvalidated(() => window.clearInterval(poll));
    const onStorage = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && changes[ENABLED_KEY]) {
        enabled = (changes[ENABLED_KEY].newValue as boolean | undefined) ?? true;
        sync();
      }
    };
    browser.storage.onChanged.addListener(onStorage);
    ctx.onInvalidated(() => browser.storage.onChanged.removeListener(onStorage));
  },
});

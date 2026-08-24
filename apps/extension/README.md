# @melofy/extension

Melofy's browser extension. Two jobs:

1. **YouTube Music now-playing + lyrics widget** — reads the current track from the
   YTM page (no YTM API exists) and renders synced, AI-translated lyrics in an
   in-page panel (shadow DOM, so the page's CSS can't touch it).
2. **Now-playing bridge for the Melofy web app** — relays the current YTM track to
   `melofy` web via `window.postMessage`, so the web app can use YouTube Music the
   same way it uses Spotify. This is why YTM support on the web *requires* the
   extension.

Built with [WXT](https://wxt.dev) + React + Tailwind. Chrome (MV3) is primary;
Firefox (MV2) is supported.

## Develop

From the repo root (the Melofy web app is the translation backend):

```bash
pnpm dev:web                          # Melofy web/API on :3009
pnpm --filter @melofy/extension dev   # WXT dev (auto-reload) — Chrome
```

Or load a build unpacked:

```bash
pnpm --filter @melofy/extension build            # → .output/chrome-mv3
pnpm --filter @melofy/extension build:firefox    # → .output/firefox-mv2
```

- **Chrome:** `chrome://extensions` → enable Developer mode → **Load unpacked** →
  `apps/extension/.output/chrome-mv3`.
- **Firefox:** `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**
  → pick any file in `apps/extension/.output/firefox-mv2`.

Then open **music.youtube.com**, play a song. The lyrics panel appears on the
page; open **localhost:3009** in another tab and the YouTube Music card shows the
live track.

## Production origin

Dev points at `http://localhost:3009` (and `127.0.0.1`). For a real deploy, set
the web origin at build time — it drives the API base, the manifest
`host_permissions`, and the web-bridge content-script `matches` from a single
source (`lib/config.ts`):

```bash
WXT_MELOFY_ORIGIN=https://melofy.app pnpm --filter @melofy/extension build
```

## Layout

- `entrypoints/youtube-music.content.tsx` — YTM content script: detects the track +
  mounts the lyrics widget (shadow root).
- `entrypoints/melofy-bridge.content.ts` — runs on the Melofy web origin; posts
  now-playing to the page.
- `entrypoints/background.ts` — service worker: LRCLIB fetch + Melofy translate
  (cross-origin, via host permissions).
- `entrypoints/popup/` — toolbar popup (shows the detected track).
- `components/LyricsWidget.tsx` (+ `lyrics-widget.css`) — the in-page panel.
- `lib/` — `nowplaying` (DOM detector + `useNowPlaying`), `lrc` (LRC parser),
  `messages`/`api` (content↔background protocol + translation cache), `config`
  (origins, storage keys).
- `public/icon/` — extension icons (16–128px).

## Known limitations

- The widget is a fixed right-side overlay, not docked into YTM's real sidebar.
- YTM selectors (`ytmusic-player-bar`, `#movie_player`) are best-effort and can
  break when YouTube Music changes its markup.
- The web bridge requires the Melofy web tab to be open alongside the YTM tab.

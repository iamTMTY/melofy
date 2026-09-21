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

## YouTube Music DOM — smoke checklist

The lyrics view mounts into YouTube Music's own lyrics tab via undocumented DOM
selectors in `entrypoints/youtube-music.content.tsx` (`findLyricsMount`). YTM
ships UI changes without notice, so **run this after any YTM redesign, and before
each Web Store release**. Takes about two minutes.

Selectors in play: `ytmusic-player-page` → `tp-yt-paper-tab` (text matches
/lyric/i; active = `aria-selected="true"` or `.iron-selected`) → `#tab-renderer`.

1. **Mounts.** Play any track, open the **Lyrics** tab. Melofy's view appears in
   place of YTM's lyrics within ~1 s. If YTM's native lyrics show instead, open
   DevTools → Console and look for `[Melofy] YTM DOM selector no longer matches:`
   — it names the selector that broke.
2. **Fails safe.** With the extension **disabled** from the popup, YTM's native
   lyrics must be visible and scrollable — never a blank tab. Re-enable; Melofy
   returns without a reload.
3. **Survives tab switches.** Lyrics → Up next → Lyrics. Melofy's view returns
   *instantly* with the same translation (no "Loading lyrics…"). A reload here
   means the React root was torn down.
4. **Survives track changes.** Skip to the next track while on the Lyrics tab.
   New lyrics load; the previous track's lines never linger.
5. **Survives navigation.** Leave the player page (click the logo), come back,
   open Lyrics. Mounts again; nothing hidden.
6. **Unsynced tracks.** Find a track LRCLIB has only as plain text (e.g. a
   traditional/spoken piece). Lines render dimmed with the "Unsynced lyrics"
   note and no line is highlighted.

If (1) fails, update the three selectors in `findLyricsMount` and re-run all six.
Do **not** widen them speculatively — a selector that matches the wrong element
hides the wrong thing, which is worse than not mounting.

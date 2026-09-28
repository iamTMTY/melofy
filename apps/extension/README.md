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
WXT_MELOFY_ORIGIN=https://melofy.temi.codes pnpm --filter @melofy/extension build
```

For a Chrome Web Store update, use `zip` with the same origin. Upload the
versioned archive from `apps/extension/.output/` to the existing item's
**Package** tab in the Chrome Web Store Developer Dashboard.

```bash
WXT_MELOFY_ORIGIN=https://melofy.temi.codes pnpm --filter @melofy/extension zip
```

## Layout

- `entrypoints/youtube-music.content.tsx` — YTM content script: detects the track +
  mounts the lyrics widget (shadow root).
- `entrypoints/melofy-bridge.content.ts` — runs on the Melofy web origin; posts
  now-playing to the page.
- `entrypoints/background.ts` — service worker: LRCLIB fetch + Melofy translate
  (cross-origin, via host permissions).
- `entrypoints/popup/` — toolbar popup (shows the detected track).
- `components/LyricsView.tsx` (+ `lyrics-view.css`) — the in-page lyrics view.
- `lib/` — `nowplaying` (DOM detector + `useNowPlaying`), `lrc` (LRC parser),
  `messages`/`api` (content↔background protocol + translation cache), `config`
  (origins, storage keys).
- `public/icon/` — extension icons (16–128px).

## Known limitations

- Fullscreen uses YouTube Music's undocumented player-page layout, so its
  selectors may need updating when YouTube Music changes the page.
- YTM selectors (`ytmusic-player-bar`, `#movie_player`) are best-effort and can
  break when YouTube Music changes its markup.
- The web bridge requires the Melofy web tab to be open alongside the YTM tab.

## YouTube Music DOM — smoke checklist

The lyrics view mounts inside YouTube Music's own `#tab-renderer`; only its
native children are hidden while Lyrics is active. Fullscreen positions YTM's
existing `#side-panel` above its unchanged player bar. These selectors live in
`entrypoints/youtube-music.content.tsx` (`playerParts`). YTM
ships UI changes without notice, so **run this after any YTM redesign, and before
each Web Store release**. Takes about two minutes.

Selectors in play: `ytmusic-player-page` → `tp-yt-paper-tab` (text matches
/lyric/i; active = `aria-selected="true"` or `.iron-selected`) → `#tab-renderer`.

1. **First open.** Play any track, open **Lyrics**. A Melofy skeleton appears
   immediately, followed by original lyrics, then a small Translating indicator
   until translated lyrics arrive. YTM's native lyrics should not flash.
2. **Fails safe.** With the extension **disabled** from the popup, YTM's native
   lyrics must be visible and scrollable — never a blank tab. Re-enable; Melofy
   returns without a reload.
3. **Survives tab switches.** Lyrics → Up next → Comments → Lyrics. Melofy's
   view returns immediately with the same translation and current line, with no
   second lyrics request or loading state.
4. **Survives track changes.** Skip to the next track while on the Lyrics tab.
   New lyrics load; the previous track's lines never linger.
5. **Survives navigation.** Leave the player page (click the logo), come back,
   open Lyrics. Mounts again; nothing hidden.
6. **Unsynced tracks.** Find a track LRCLIB has only as plain text (e.g. a
   traditional/spoken piece). Lines render dimmed with the "Unsynced lyrics"
   note and no line is highlighted.
7. **Fullscreen.** Expand from the bottom-right lyrics button. Switch among
   Up next, Lyrics, Comments, and Related. The native tab strip and bottom
   player bar stay clickable. Lyrics are centered over a blurred album-art
   background; seek, pause, skip, then exit with the button or Escape.
8. **Manual scrolling.** Scroll a synced song with the wheel, touch, scrollbar,
   or keyboard. The view stays where you leave it as the song advances; **Follow
   current line** resumes automatic centering. Unsynced lyrics scroll from the
   first line to the last in both sidebar and fullscreen views.
9. **Stable playback.** Leave a synced song playing through changes to its
   duration or album metadata. Its lyrics and translation should stay visible
   without another loading skeleton. Skip to a different song and confirm the
   new lyrics load. If LRCLIB cannot find lyrics, **Try again** retries without
   changing songs.

If (1) fails, check `playerParts` in the content script and re-run the checklist.
Do **not** widen selectors speculatively — a selector that matches the wrong
element hides the wrong thing, which is worse than not mounting.

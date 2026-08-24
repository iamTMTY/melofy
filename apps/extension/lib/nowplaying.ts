import { useEffect, useState } from 'react';
import type { NowPlaying, TrackMetadata } from '@melofy/core';

// YouTube Music renders a persistent player bar. We read the track from its DOM
// and the position/paused state from the underlying <video>. (Cross-origin
// MediaSession can't be read by another page, so DOM scraping is the approach.)
const PLAYER_BAR = 'ytmusic-player-bar';

function text(el: Element | null | undefined): string {
  return (el?.textContent ?? '').trim();
}

// Pick the <video> that is ACTUALLY playing this song. At a track change YTM can
// leave a stale, ended <video> in the DOM; reading its frozen currentTime is a
// prime cause of the lyrics desyncing. Prefer a playing element with real media.
function activeVideo(): HTMLVideoElement | null {
  const vids = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
  const playing = vids.find(
    (v) => !v.paused && v.readyState >= 2 && Number.isFinite(v.duration) && v.duration > 0
  );
  return (
    playing ||
    document.querySelector<HTMLVideoElement>('ytmusic-player video') ||
    document.querySelector<HTMLVideoElement>('#movie_player video') ||
    vids[0] ||
    null
  );
}

/** Parse a "m:ss" / "h:mm:ss" clock string to ms, or null. */
function parseClock(s: string | undefined): number | null {
  if (!s) return null;
  const parts = s.trim().split(':');
  if (!parts.length || parts.some((p) => p === '' || !/^\d+$/.test(p))) return null;
  return parts.reduce((sec, p) => sec * 60 + Number(p), 0) * 1000;
}

// Position straight from YTM's player bar — the SAME component the title/lyrics
// come from, so it can never point at a different song than what we display.
// Read from the progress slider (seconds) or the "1:23 / 3:45" time text. Returns
// null if neither is present (then we fall back to the <video>).
function readBarPositionMs(bar: Element): number | null {
  const now = bar.querySelector('#progress-bar')?.getAttribute('aria-valuenow');
  if (now != null && /^\d+(\.\d+)?$/.test(now)) return Math.round(Number(now) * 1000);
  return parseClock(bar.querySelector('.time-info')?.textContent?.split('/')[0]);
}

/** One synchronous read of the current player state, or null if nothing is loaded. */
export function readNowPlaying(): NowPlaying | null {
  const bar = document.querySelector(PLAYER_BAR);
  const video = activeVideo();
  if (!bar || !video) return null;

  // Don't report ads as the current track.
  if (document.querySelector('#movie_player')?.classList.contains('ad-showing')) return null;

  const title = text(bar.querySelector('.title')) || text(bar.querySelector('yt-formatted-string.title'));
  if (!title) return null;

  // Byline is "Artist • Album • Year" as bullet-separated links.
  const byline = bar.querySelector('.byline');
  const bylineLinks = byline ? Array.from(byline.querySelectorAll('a')).map(text) : [];
  const artist = bylineLinks[0] || text(byline).split('•')[0]?.trim() || '';
  const album = bylineLinks[1] || '';

  const img = bar.querySelector<HTMLImageElement>('img');
  const albumArtUrl = img?.src || '';

  const track: TrackMetadata = {
    artist,
    title,
    album,
    albumArtUrl,
    durationMs: Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : 0,
    service: 'youtube_music',
  };

  // Position: trust the <video> for smoothness, but when it's out of step with
  // the player bar by more than ~2.5s (a stale element at a track change, or a
  // freshly-reset video still catching up), trust the bar — it always matches the
  // on-screen song. 2.5s stays above the normal sub-second video/bar rounding gap.
  const videoMs = Number.isFinite(video.currentTime) ? Math.round(video.currentTime * 1000) : 0;
  const barMs = readBarPositionMs(bar);
  let positionMs = videoMs;
  if (barMs != null && barMs >= 0 && Math.abs(barMs - videoMs) > 2500) {
    positionMs = barMs;
  }

  return {
    track,
    positionMs,
    isPlaying: !video.paused,
    capturedAt: Date.now(),
  };
}

const trackKey = (np: NowPlaying) => `${np.track.artist} ${np.track.title}`;

/**
 * Guards against a stale position at a track change. When YouTube Music autoplays
 * the next song, the player bar shows the new title a beat before the <video>
 * position lines up with the new song. Mapping that stale position onto the
 * freshly-loaded lyrics is what throws the active line out of sync. So on a
 * genuine track change we hold the reported position at 0 until the clock has
 * clearly reset (position drops, or is near the start) — then trust it.
 *
 * Returns a stateful function; create one per polling loop. The first track seen
 * is NOT suppressed (so opening the widget mid-song syncs immediately); only
 * later transitions are.
 */
function makeSettler(): (np: NowPlaying) => NowPlaying {
  let lastKey = '';
  let lastPos = 0;
  let settled = true;
  let changeAt = 0;
  return (np) => {
    const key = trackKey(np);
    if (key !== lastKey) {
      if (lastKey !== '') {
        settled = false; // a real transition, not the initial load
        changeAt = np.capturedAt;
      }
      lastKey = key;
    }
    if (!settled) {
      const dropped = np.positionMs < lastPos - 1000; // timeline reset to the new song
      const nearStart = np.positionMs <= 3000; // new song genuinely started
      const timedOut = np.capturedAt - changeAt > 2000; // safety valve — never stick
      if (dropped || nearStart || timedOut) {
        settled = true;
      } else {
        lastPos = np.positionMs;
        return { ...np, positionMs: 0 };
      }
    }
    lastPos = np.positionMs;
    return np;
  };
}

/**
 * Poll the player. Calls `onChange` when the track identity changes and `onTick`
 * every poll (for position). Returns a stop function.
 */
export function watchNowPlaying(opts: {
  onChange: (np: NowPlaying) => void;
  onTick?: (np: NowPlaying) => void;
  intervalMs?: number;
}): () => void {
  let lastKey = '';
  const settle = makeSettler();
  const tick = () => {
    const raw = readNowPlaying();
    if (!raw) return;
    const np = settle(raw); // hold position steady across the track-change gap
    const key = trackKey(raw);
    if (key !== lastKey) {
      lastKey = key;
      opts.onChange(np);
    }
    opts.onTick?.(np);
  };
  tick();
  const id = window.setInterval(tick, opts.intervalMs ?? 1000);
  return () => window.clearInterval(id);
}

export { NOW_PLAYING_KEY } from './config';

/**
 * React hook: the live now-playing snapshot, polled from the page. Fast enough
 * (default 300ms) to drive active-line highlighting in the widget.
 */
export function useNowPlaying(intervalMs = 300): NowPlaying | null {
  const [np, setNp] = useState<NowPlaying | null>(null);
  useEffect(() => {
    const settle = makeSettler();
    const tick = () => {
      const raw = readNowPlaying();
      // Suppress the stale position during a track change so the active lyric
      // line doesn't race ahead of the new song's intro.
      setNp(raw ? settle(raw) : null);
    };
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return np;
}

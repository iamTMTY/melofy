import { useEffect, useState } from 'react';
import type { NowPlaying, TrackMetadata } from '@melofy/core';

const PLAYER_BAR = 'ytmusic-player-bar';
export type YouTubeMusicNowPlaying = NowPlaying & { videoId: string | null };

const currentVideoId = () => new URLSearchParams(window.location.search).get('v');

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

function parseClock(s: string | undefined): number | null {
  if (!s) return null;
  const parts = s.trim().split(':');
  if (!parts.length || parts.some((p) => p === '' || !/^\d+$/.test(p))) return null;
  return parts.reduce((sec, p) => sec * 60 + Number(p), 0) * 1000;
}

function readBarPositionMs(bar: Element): number | null {
  const now = bar.querySelector('#progress-bar')?.getAttribute('aria-valuenow');
  if (now != null && /^\d+(\.\d+)?$/.test(now)) return Math.round(Number(now) * 1000);
  return parseClock(bar.querySelector('.time-info')?.textContent?.split('/')[0]);
}

export function readNowPlaying(): YouTubeMusicNowPlaying | null {
  const bar = document.querySelector(PLAYER_BAR);
  const video = activeVideo();
  if (!bar || !video) return null;

  if (document.querySelector('#movie_player')?.classList.contains('ad-showing')) return null;

  const title = text(bar.querySelector('.title')) || text(bar.querySelector('yt-formatted-string.title'));
  if (!title) return null;

  const byline = bar.querySelector('.byline');
  const bylineLinks = byline ? Array.from(byline.querySelectorAll('a')).map(text) : [];
  const artist = bylineLinks[0] || text(byline).split('•')[0]?.trim() || '';
  if (!artist) return null;
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
    videoId: currentVideoId(),
    positionMs,
    isPlaying: !video.paused,
    capturedAt: Date.now(),
  };
}

const metadataKey = (np: NowPlaying) => `${np.track.artist} ${np.track.title}`;
const trackKey = (np: YouTubeMusicNowPlaying) => `${np.videoId ?? ''} ${metadataKey(np)}`;

function makeSettler<T extends YouTubeMusicNowPlaying>(): (np: T) => T {
  let lastKey = '';
  let lastPos = 0;
  let settled = true;
  let changeAt = 0;
  return (np) => {
    const key = trackKey(np);
    if (key !== lastKey) {
      if (lastKey !== '') {
        settled = false;
        changeAt = np.capturedAt;
      }
      lastKey = key;
    }
    if (!settled) {
      const dropped = np.positionMs < lastPos - 1000;
      const nearStart = np.positionMs <= 3000;
      const timedOut = np.capturedAt - changeAt > 2000;
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

export function watchNowPlaying(opts: {
  onChange?: (np: NowPlaying) => void;
  onTick?: (np: NowPlaying) => void;
  intervalMs?: number;
}): () => void {
  let lastKey = '';
  const settle = makeSettler<YouTubeMusicNowPlaying>();
  const tick = () => {
    const raw = readNowPlaying();
    if (!raw) return;
    const np = settle(raw);
    const key = trackKey(raw);
    if (key !== lastKey) {
      lastKey = key;
      opts.onChange?.(np);
    }
    opts.onTick?.(np);
  };
  tick();
  const id = window.setInterval(tick, opts.intervalMs ?? 1000);
  return () => window.clearInterval(id);
}

export { NOW_PLAYING_KEY } from './config';

export function useNowPlaying(intervalMs = 300): YouTubeMusicNowPlaying | null {
  const [np, setNp] = useState<YouTubeMusicNowPlaying | null>(null);
  useEffect(() => {
    const settle = makeSettler<YouTubeMusicNowPlaying>();
    let videoId = currentVideoId();
    let previousIdentity = '';
    let routeChangedAt = 0;
    let routeCandidate = '';
    let routeCandidateSince = 0;
    const tick = () => {
      const now = Date.now();
      const nextVideoId = currentVideoId();
      if (nextVideoId !== videoId) {
        videoId = nextVideoId;
        routeChangedAt = now;
        routeCandidate = '';
        setNp(null);
        return;
      }
      if (document.querySelector('#movie_player')?.classList.contains('ad-showing')) {
        setNp(null);
        return;
      }
      const raw = readNowPlaying();
      if (raw) {
        // YTM can update the URL before the player bar. Do not look up the old
        // song under the new video ID while its metadata is catching up.
        if (routeChangedAt) {
          const identity = metadataKey(raw);
          if (identity === previousIdentity && now - routeChangedAt < 1200) return;
          if (identity !== routeCandidate) {
            routeCandidate = identity;
            routeCandidateSince = now;
            return;
          }
          if (now - routeCandidateSince < 300) return;
        }
        routeChangedAt = 0;
        previousIdentity = metadataKey(raw);
        setNp(settle(raw));
      }
      // Keep the last valid reading when YTM briefly removes the video or bar.
      // The URL change above clears it as soon as a different song starts.
    };
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return np;
}

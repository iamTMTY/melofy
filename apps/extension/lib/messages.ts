import type { LrcLine } from './lrc';

// Content script → background messaging protocol. Background performs the
// cross-origin fetches (LRCLIB, Melofy API) using host permissions, so the
// content script never hits CORS.

export interface GetLyricsReq {
  type: 'GET_LYRICS';
  artist: string;
  title: string;
  album?: string;
  durationMs?: number;
}
export interface GetLyricsRes {
  ok: boolean;
  lines?: LrcLine[];
  synced?: boolean;
  error?: string;
}

export interface TranslateReq {
  type: 'TRANSLATE';
  lines: string[];
  /** LRC timings parallel to `lines`; null per line when unsynced. */
  timeMs?: (number | null)[];
  targetLanguage: string;
  artist?: string;
  title?: string;
  /** Recording identity — keeps two masters of a song on separate cache entries. */
  album?: string;
  durationMs?: number;
}
export interface TranslateRes {
  ok: boolean;
  translated?: string[];
  sourceLanguage?: string;
  error?: string;
}

/** Fire-and-forget analytics event, forwarded by the background worker (which
 *  holds host permissions, so it can reach the Melofy API without CORS). */
export interface TrackReq {
  type: 'TRACK';
  event: string;
  properties?: Record<string, unknown>;
}

export type Req = GetLyricsReq | TranslateReq | TrackReq;

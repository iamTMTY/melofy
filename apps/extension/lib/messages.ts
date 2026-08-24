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
  targetLanguage: string;
  artist?: string;
  title?: string;
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

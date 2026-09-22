import type { LrcLine } from './lrc';

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
  timeMs?: (number | null)[];
  targetLanguage: string;
  artist?: string;
  title?: string;
  album?: string;
  durationMs?: number;
}
export interface TranslateRes {
  ok: boolean;
  translated?: string[];
  sourceLanguage?: string;
  error?: string;
}

export interface TrackReq {
  type: 'TRACK';
  event: string;
  properties?: Record<string, unknown>;
}

export type Req = GetLyricsReq | TranslateReq | TrackReq;

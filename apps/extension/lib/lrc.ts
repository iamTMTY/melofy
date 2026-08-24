// A lyric line as parsed from LRCLIB. `timeMs` is null for unsynced (plain) lyrics.
export interface LrcLine {
  timeMs: number | null;
  text: string;
}

const TAG_RE = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

/** Parse LRC (synced) lyrics: `[mm:ss.xx] text`, one timecode (or more) per line. */
export function parseLrc(raw: string): LrcLine[] {
  const out: LrcLine[] = [];
  for (const line of raw.split('\n')) {
    const tags = [...line.matchAll(TAG_RE)];
    const text = line.replace(TAG_RE, '').trim();
    if (tags.length === 0) {
      if (text) out.push({ timeMs: null, text });
      continue;
    }
    for (const m of tags) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const frac = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) : 0;
      if (text) out.push({ timeMs: min * 60000 + sec * 1000 + frac, text });
    }
  }
  return out.sort((a, b) => (a.timeMs ?? 0) - (b.timeMs ?? 0));
}

/** Parse plain (unsynced) lyrics into timecode-less lines. */
export function parsePlain(raw: string): LrcLine[] {
  return raw
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text) => ({ timeMs: null, text }));
}

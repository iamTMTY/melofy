import type { LyricLine } from '@/lib/types';

const LRC_LINE_REGEX = /^\[(\d{2,3}):(\d{2})\.(\d{2,3})\]\s*(.+)/;

interface LRCLIBResponse {
  id: number;
  trackName: string;
  artistName: string;
  duration?: number;
  syncedLyrics: string | null;
  plainLyrics: string | null;
}

export interface LyricsResult {
  lines: LyricLine[];
  /**
   * False when LRCLIB only had plain text, or when its LRC belongs to a different
   * recording of the song. Callers surface that as an error rather than showing
   * words on invented timings — a wrong highlight is worse than none.
   */
  synced: boolean;
}

const NO_LYRICS: LyricsResult = { lines: [], synced: false };

export function parseLRC(lrcContent: string): LyricLine[] {
  const lines = lrcContent.split('\n');
  const lyrics: LyricLine[] = [];
  let index = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(LRC_LINE_REGEX);
    if (!match) continue;

    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const milliseconds = parseInt(match[3].padEnd(3, '0'), 10);
    const text = match[4].trim();

    if (!text) continue;

    const timeMs = minutes * 60000 + seconds * 1000 + milliseconds;

    lyrics.push({
      index: index++,
      timeMs,
      durationMs: 0,
      original: text,
    });
  }

  for (let i = 0; i < lyrics.length; i++) {
    if (i < lyrics.length - 1) {
      lyrics[i].durationMs = lyrics[i + 1].timeMs - lyrics[i].timeMs;
    } else {
      lyrics[i].durationMs = 5000;
    }
  }

  return lyrics;
}

function plainTextToLRC(plain: string): LyricsResult {
  const lines = plain
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Some uploads land in `plainLyrics` but already carry [mm:ss.xx] stamps — real
  // timings, so trust them.
  if (LRC_LINE_REGEX.test(lines[0] || '')) {
    return { lines: parseLRC(plain), synced: true };
  }

  // Evenly spaced placeholders. `synced: false` means nothing renders these; they
  // exist so a caller can tell "lyrics exist, unsynced" from "nothing at all".
  return {
    lines: lines.map((original, index) => ({
      index,
      timeMs: index * 5000,
      durationMs: 5000,
      original,
    })),
    synced: false,
  };
}

const SAMPLE_LRC_DATABASE: Record<string, string> = {
  'bts|dynamite': `[00:00.00]
[00:12.50]Cos ah ah I'm in the stars tonight
[00:16.20]So watch me bring the fire and set the night alight
[00:20.40]Shining through the city with a little funk and soul
[00:24.40]So I'ma light it up like dynamite, woah
[00:28.60]Bring a friend, join the crowd
[00:31.80]Whoever wanna come along
[00:34.10]Word up, talk the talk, just move like we off the wall
[00:38.20]Day or night, the sky's alight
[00:40.40]So we dance to the break of dawn
[00:42.60]Ladies and gentlemen, I got the medicine
[00:45.20]So you should keep your eyes on the ball, huh
[00:47.50]This is getting heavy, can you hear the bass boom? I'm ready
[00:52.40]Life is sweet as honey, yeah, this beat cha-ching like money, huh
[00:57.00]Disco overload, I'm into that, I'm good to go
[01:01.80]I'm diamond, you know I glow up
[01:04.80]Hey, so let's go
[01:06.20]Cos ah ah I'm in the stars tonight
[01:09.80]So watch me bring the fire and set the night alight
[01:13.80]Shining through the city with a little funk and soul
[01:17.80]So I'ma light it up like dynamite, woah
[01:22.40]Dyn-n-n-n-na-na-na, life is dynamite
[01:26.60]Dyn-n-n-n-na-na-na, life is dynamite
[01:30.60]Shining through the city with a little funk and soul
[01:34.50]So I'ma light it up like dynamite, woah`,
};

async function fetchFromLRCLIB(
  artist: string,
  title: string,
  durationMs?: number,
  album?: string
): Promise<LyricsResult> {
  // An LRC written for a different master drifts against this one, so synced
  // lyrics are only trustworthy when the runtimes agree. /api/get is already
  // duration-exact when we know the runtime; search results we check ourselves.
  const sameRecording = (r: { duration?: number }) =>
    !durationMs || !r.duration || Math.abs(r.duration * 1000 - durationMs) <= 2000;

  const fromRecord = (rec: LRCLIBResponse): LyricsResult => {
    if (rec.syncedLyrics && sameRecording(rec)) {
      return { lines: parseLRC(rec.syncedLyrics), synced: true };
    }
    if (rec.plainLyrics) return plainTextToLRC(rec.plainLyrics);
    // Synced, but for the wrong recording — the words are right, the clock isn't.
    if (rec.syncedLyrics) return { lines: parseLRC(rec.syncedLyrics), synced: false };
    return NO_LYRICS;
  };

  const tryGet = async (a: string, t: string): Promise<LyricsResult> => {
    const params = new URLSearchParams({ artist_name: a, track_name: t });
    // `duration` (seconds) makes LRCLIB return the LRC synced to THIS recording;
    // without it, a name-match can be a DIFFERENT master whose section timings
    // drift. `album_name` sharpens the match. Mirrors the extension's fetch.
    if (album) params.set('album_name', album);
    if (durationMs && durationMs > 0) params.set('duration', String(Math.round(durationMs / 1000)));
    const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return NO_LYRICS;

    return fromRecord(await res.json());
  };

  const trySearch = async (params: Record<string, string>): Promise<LRCLIBResponse[]> => {
    const res = await fetch(`https://lrclib.net/api/search?${new URLSearchParams(params)}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const results = await res.json();
    return Array.isArray(results) ? results : [];
  };

  // Only a SYNCED result ends the search. Unsynced words are banked as a
  // fallback instead of returned, so a plain-only (or wrong-master) exact hit
  // can't hide a properly synced upload indexed under a different credit.
  // Banked in priority order — the exact artist/title/duration match first.
  const fallbacks: LyricsResult[] = [];
  const take = (r: LyricsResult): LyricsResult | null => {
    if (r.lines.length === 0) return null;
    if (r.synced) return r;
    fallbacks.push(r);
    return null;
  };

  try {
    const exact = take(await tryGet(artist, title));
    if (exact) return exact;

    // LRCLIB ANDs artist_name + track_name, so it finds nothing when the credit
    // we were handed doesn't match the one it indexed — a featured artist, or the
    // producer credited first ("Killertunes, Solana" vs LRCLIB's "Solana"). Its
    // free-text `q` matches either field, so retry that before giving up.
    let results = await trySearch({ artist_name: artist, track_name: title });
    if (results.length === 0) results = await trySearch({ q: `${artist} ${title}` });

    if (results.length > 0) {
      const best = results.find((r) => r.syncedLyrics && sameRecording(r)) || results[0];
      const viaGet = take(await tryGet(best.artistName, best.trackName));
      if (viaGet) return viaGet;

      const fromBest = take(fromRecord(best));
      if (fromBest) return fromBest;
    }

    return fallbacks[0] ?? NO_LYRICS;
  } catch (err) {
    console.warn('[Lyrics] LRCLIB fetch failed:', err);
    return NO_LYRICS;
  }
}

export async function fetchLyrics(
  artist: string,
  title: string,
  durationMs?: number,
  album?: string
): Promise<LyricsResult> {
  const key = `${artist.toLowerCase().trim()}|${title.toLowerCase().trim()}`;

  const lrclibResult = await fetchFromLRCLIB(artist, title, durationMs, album);
  if (lrclibResult.lines.length > 0) {
    console.log(
      `[Lyrics] Found on LRCLIB: ${artist} - ${title} ` +
        `(${lrclibResult.lines.length} lines, synced=${lrclibResult.synced})`
    );
    return lrclibResult;
  }

  if (SAMPLE_LRC_DATABASE[key]) {
    console.log(`[Lyrics] Found in sample DB: ${artist} - ${title}`);
    return { lines: parseLRC(SAMPLE_LRC_DATABASE[key]), synced: true };
  }

  console.log(`[Lyrics] Not found: ${artist} - ${title}`);
  return NO_LYRICS;
}

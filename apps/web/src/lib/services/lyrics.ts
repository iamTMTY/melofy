import type { LyricLine } from '@/lib/types';

const LRC_LINE_REGEX = /^\[(\d{2,3}):(\d{2})\.(\d{2,3})\]\s*(.+)/;

interface LRCLIBResponse {
  id: number;
  trackName: string;
  artistName: string;
  syncedLyrics: string | null;
  plainLyrics: string | null;
}

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

function plainTextToLRC(plain: string): LyricLine[] {
  const lines = plain
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (LRC_LINE_REGEX.test(lines[0] || '')) {
    return parseLRC(plain);
  }

  const lyrics: LyricLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    lyrics.push({
      index: i,
      timeMs: i * 5000,
      durationMs: 5000,
      original: lines[i],
    });
  }

  return lyrics;
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

async function fetchFromLRCLIB(artist: string, title: string): Promise<LyricLine[]> {
  const tryGet = async (a: string, t: string): Promise<LyricLine[]> => {
    const params = new URLSearchParams({ artist_name: a, track_name: t });
    const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return [];

    const data: LRCLIBResponse = await res.json();

    if (data.syncedLyrics) return parseLRC(data.syncedLyrics);
    if (data.plainLyrics) return plainTextToLRC(data.plainLyrics);
    return [];
  };

  try {
    const exact = await tryGet(artist, title);
    if (exact.length > 0) return exact;

    const searchParams = new URLSearchParams({ artist_name: artist, track_name: title });
    const searchRes = await fetch(`https://lrclib.net/api/search?${searchParams.toString()}`, {
      signal: AbortSignal.timeout(15000),
    });

    if (searchRes.ok) {
      const results = await searchRes.json();
      if (Array.isArray(results) && results.length > 0) {
        const best = results[0];
        const searchMatch = await tryGet(best.artistName, best.trackName);
        if (searchMatch.length > 0) return searchMatch;

        if (best.syncedLyrics) return parseLRC(best.syncedLyrics);
        if (best.plainLyrics) return plainTextToLRC(best.plainLyrics);
      }
    }

    return [];
  } catch (err) {
    console.warn('[Lyrics] LRCLIB fetch failed:', err);
    return [];
  }
}

export async function fetchLyrics(artist: string, title: string): Promise<LyricLine[]> {
  const key = `${artist.toLowerCase().trim()}|${title.toLowerCase().trim()}`;

  const lrclibResult = await fetchFromLRCLIB(artist, title);
  if (lrclibResult.length > 0) {
    console.log(`[Lyrics] Found on LRCLIB: ${artist} - ${title} (${lrclibResult.length} lines)`);
    return lrclibResult;
  }

  if (SAMPLE_LRC_DATABASE[key]) {
    console.log(`[Lyrics] Found in sample DB: ${artist} - ${title}`);
    return parseLRC(SAMPLE_LRC_DATABASE[key]);
  }

  console.log(`[Lyrics] Not found: ${artist} - ${title}`);
  return [];
}

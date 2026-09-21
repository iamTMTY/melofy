import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchLyrics } from './lyrics';

// Two things are pinned here:
//  1. LRCLIB ANDs artist_name + track_name, so the credit YouTube Music hands us
//     ("Killertunes, Solana") misses what LRCLIB indexed ("Solana") and used to
//     dead-end at 404. The free-text `q` retry rescues it.
//  2. `synced` must be false unless the timings really belong to this recording —
//     callers show an error rather than words on invented timings.

function mockLrclib(routes: Record<string, unknown>) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(url);
    const hit = Object.entries(routes).find(([frag]) => url.includes(frag));
    if (!hit) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => hit[1] };
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchLyrics LRCLIB fallback', () => {
  it('falls back to free-text q when the artist-scoped search finds nothing', async () => {
    const calls = mockLrclib({
      'q=Killertunes': [
        { artistName: 'Solana', trackName: 'Okunkun', duration: 159, syncedLyrics: null, plainLyrics: 'one\ntwo' },
      ],
    });

    const { lines, synced } = await fetchLyrics('Killertunes, Solana', 'Okunkun', 159000);

    expect(lines.map((l) => l.original)).toEqual(['one', 'two']);
    expect(synced).toBe(false); // plain text — caller errors instead of faking timings
    expect(calls.some((u) => u.includes('/api/search?q='))).toBe(true);
  });

  it('reports unsynced when LRCLIB only has plain lyrics', async () => {
    mockLrclib({ '/api/get?': { artistName: 'A', trackName: 'T', syncedLyrics: null, plainLyrics: 'la\nla' } });

    expect(await fetchLyrics('A', 'T')).toMatchObject({ synced: false });
  });

  it('treats plain lyrics that already carry timestamps as synced', async () => {
    mockLrclib({
      '/api/get?': { artistName: 'A', trackName: 'T', syncedLyrics: null, plainLyrics: '[00:10.00]stamped' },
    });

    const { lines, synced } = await fetchLyrics('A', 'T');

    expect(synced).toBe(true);
    expect(lines).toEqual([{ index: 0, timeMs: 10000, durationMs: 5000, original: 'stamped' }]);
  });

  it('marks a synced hit from a different recording as unsynced', async () => {
    mockLrclib({
      '/api/search?artist_name=': [
        { artistName: 'A', trackName: 'T', duration: 240, syncedLyrics: '[00:10.00]wrong master', plainLyrics: null },
      ],
    });

    // A 240s LRC against a 159s track drifts — the bad-sync bug.
    expect(await fetchLyrics('A', 'T', 159000)).toMatchObject({ synced: false });
  });

  it('takes a synced hit whose duration matches the track', async () => {
    mockLrclib({
      '/api/search?artist_name=': [
        { artistName: 'A', trackName: 'T', duration: 240, syncedLyrics: '[00:10.00]wrong master', plainLyrics: null },
        { artistName: 'A', trackName: 'T', duration: 160, syncedLyrics: '[00:10.00]right master', plainLyrics: null },
      ],
    });

    const { lines, synced } = await fetchLyrics('A', 'T', 159000);

    expect(synced).toBe(true);
    expect(lines.map((l) => l.original)).toEqual(['right master']);
  });

  it('still returns nothing when LRCLIB has no match at all', async () => {
    mockLrclib({});
    expect(await fetchLyrics('Nobody', 'Nothing')).toEqual({ lines: [], synced: false });
  });
});

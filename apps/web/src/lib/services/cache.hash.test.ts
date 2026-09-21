import { describe, it, expect } from 'vitest';
import { generateHash } from './cache';

// Regression (Mira review): the shared cache stores lyrics WITH their timings, so
// two masters of one song must never land on the same entry — otherwise one
// recording's timings get served for another's audio.
describe('generateHash recording identity', () => {
  const base = ['Sola Allyson', 'Eji Owuro', 'en'] as const;

  it('separates two masters of the same song', () => {
    const a = generateHash(...base, { album: 'Eji Owuro', durationMs: 386_000 });
    const b = generateHash(...base, { album: 'Gbeje Fun Mi', durationMs: 384_000 });
    expect(a).not.toBe(b);
  });

  it('separates on duration alone when the album matches', () => {
    const a = generateHash(...base, { album: 'Same Album', durationMs: 386_000 });
    const b = generateHash(...base, { album: 'Same Album', durationMs: 384_000 });
    expect(a).not.toBe(b);
  });

  it('tolerates sub-second jitter between sources for one master', () => {
    // YTM scrapes from <video>, Spotify reports its own value; they disagree in
    // the low digits. Same master must still share a cache entry.
    const a = generateHash(...base, { album: 'A', durationMs: 386_000 });
    const b = generateHash(...base, { album: 'A', durationMs: 386_400 });
    expect(a).toBe(b);
  });

  it('still keys on the song when no recording info is available', () => {
    expect(generateHash(...base)).toBe(generateHash(...base, {}));
  });

  it('canonicalizes the album the way it canonicalizes artist/title', () => {
    const a = generateHash(...base, { album: 'Ẹ̀dùn  Ọkàn', durationMs: 200_000 });
    const b = generateHash(...base, { album: 'ẹ̀dùn ọkàn', durationMs: 200_000 });
    expect(a).toBe(b);
  });
});

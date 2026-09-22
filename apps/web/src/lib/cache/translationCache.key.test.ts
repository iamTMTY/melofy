import { describe, it, expect } from 'vitest';
import { translationCacheKeyForTest as makeKey } from './translationCache';

describe('client cache key recording identity', () => {
  it('separates two masters of the same song', () => {
    expect(makeKey('Sola Allyson', 'Eji Owuro', 'en', { album: 'A', durationMs: 386_000 })).not.toBe(
      makeKey('Sola Allyson', 'Eji Owuro', 'en', { album: 'B', durationMs: 384_000 })
    );
  });

  it('tolerates sub-second jitter within one master', () => {
    expect(makeKey('A', 'B', 'en', { album: 'X', durationMs: 200_000 })).toBe(
      makeKey('A', 'B', 'en', { album: 'X', durationMs: 200_400 })
    );
  });

  it('hashes identically whether recording info is absent or empty', () => {
    expect(makeKey('A', 'B', 'en')).toBe(makeKey('A', 'B', 'en', {}));
  });
});

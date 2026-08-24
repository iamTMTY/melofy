import { describe, it, expect } from 'vitest';
import { generateHash } from './cache';

// The cache key is what makes a song a hit/miss. The canonicalization here is the
// exact thing that regressed once (the "Bá'núsọ" 429): different encodings of the
// SAME song must collapse to one key, and genuinely different songs must not.
describe('generateHash — cache key canonicalization', () => {
  const title = 'Bá’núsọ'; // curly apostrophe, precomposed diacritics
  const base = generateHash('Brymo', title, 'en');

  it('is a 64-char sha256 hex', () => {
    expect(base).toMatch(/^[0-9a-f]{64}$/);
  });

  it('collapses case / whitespace / apostrophe-style / NFD vs NFC to one key', () => {
    expect(generateHash('brymo', title, 'en')).toBe(base); // case
    expect(generateHash('  Brymo  ', `  ${title}  `, 'en')).toBe(base); // whitespace
    expect(generateHash('Brymo', "Bá'núsọ", 'en')).toBe(base); // straight apostrophe
    expect(generateHash('Brymo', title.normalize('NFD'), 'en')).toBe(base); // NFD → NFC
    expect(generateHash('Brymo', title, 'EN')).toBe(base); // lang case
  });

  it('differs by title, artist, and target language', () => {
    expect(generateHash('Brymo', 'Ọlánrewájú', 'en')).not.toBe(base);
    expect(generateHash('Wizkid', title, 'en')).not.toBe(base);
    expect(generateHash('Brymo', title, 'fr')).not.toBe(base);
  });
});

import { describe, it, expect } from 'vitest';
import { generateHash } from './cache';

describe('generateHash — cache key canonicalization', () => {
  const title = 'Bá’núsọ';
  const base = generateHash('Brymo', title, 'en');

  it('is a 64-char sha256 hex', () => {
    expect(base).toMatch(/^[0-9a-f]{64}$/);
  });

  it('collapses case / whitespace / apostrophe-style / NFD vs NFC to one key', () => {
    expect(generateHash('brymo', title, 'en')).toBe(base);
    expect(generateHash('  Brymo  ', `  ${title}  `, 'en')).toBe(base);
    expect(generateHash('Brymo', "Bá'núsọ", 'en')).toBe(base);
    expect(generateHash('Brymo', title.normalize('NFD'), 'en')).toBe(base);
    expect(generateHash('Brymo', title, 'EN')).toBe(base);
  });

  it('differs by title, artist, and target language', () => {
    expect(generateHash('Brymo', 'Ọlánrewájú', 'en')).not.toBe(base);
    expect(generateHash('Wizkid', title, 'en')).not.toBe(base);
    expect(generateHash('Brymo', title, 'fr')).not.toBe(base);
  });
});

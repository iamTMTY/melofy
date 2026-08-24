import { describe, it, expect } from 'vitest';
import { parseTranslationResponse, looksLikeRefusal, detectSourceLanguage } from './translation';
import type { LyricLine } from '@/lib/types';

// These take a model's OUTPUT as a plain string and turn it into aligned lyrics —
// no model is invoked here, we feed canned output.
const lyrics: LyricLine[] = [
  { index: 0, timeMs: 1000, durationMs: 2000, original: 'Ojú ayé le' },
  { index: 1, timeMs: 3000, durationMs: 2000, original: 'Mo ní ìrètí' },
];

describe('parseTranslationResponse', () => {
  it('aligns translated lines to originals by LRC timecode, preserving timing/original', () => {
    const out = '[00:01.00] Life is hard\n[00:03.00] But I have hope';
    const { translatedLyrics } = parseTranslationResponse(out, lyrics);
    expect(translatedLyrics.map((l) => l.translated)).toEqual(['Life is hard', 'But I have hope']);
    expect(translatedLyrics[0].original).toBe('Ojú ayé le');
    expect(translatedLyrics[0].timeMs).toBe(1000);
  });

  it('falls back to line order when the output has no timecodes', () => {
    const { translatedLyrics } = parseTranslationResponse('Life is hard\nBut I have hope', lyrics);
    expect(translatedLyrics.map((l) => l.translated)).toEqual(['Life is hard', 'But I have hope']);
  });

  it('keeps the original text for a line the model dropped', () => {
    const { translatedLyrics } = parseTranslationResponse('[00:01.00] Life is hard', lyrics);
    expect(translatedLyrics[0].translated).toBe('Life is hard');
    expect(translatedLyrics[1].translated).toBe('Mo ní ìrètí'); // untouched
  });
});

describe('looksLikeRefusal', () => {
  it('flags a short refusal blurb', () => {
    expect(looksLikeRefusal("I'm sorry, I can't assist with that request.", 10)).toBe(true);
  });
  it('does not flag real LRC output', () => {
    expect(looksLikeRefusal('[00:01.00] Line one\n[00:03.00] Line two', 2)).toBe(false);
  });
  it('does not flag a full-length plain translation', () => {
    const text = Array.from({ length: 8 }, (_, i) => `line ${i}`).join('\n');
    expect(looksLikeRefusal(text, 8)).toBe(false);
  });
});

describe('detectSourceLanguage', () => {
  const one = (s: string): LyricLine[] => [{ index: 0, timeMs: 0, durationMs: 0, original: s }];
  it('detects by script, defaulting to English', () => {
    expect(detectSourceLanguage(one('こんにちは'))).toBe('ja');
    expect(detectSourceLanguage(one('안녕하세요'))).toBe('ko');
    expect(detectSourceLanguage(one('مرحبا'))).toBe('ar');
    expect(detectSourceLanguage(one('Hello world'))).toBe('en');
  });
});

// Small, verified glossary for phrases a model can mistake for names or
// ad-libs. Keep the original lyric untouched; correct only a
// translation that still reads like a transliteration of the source phrase.
export function correctTranslationLine(original: string, translated: string, targetLanguage: string): string {
  if (!/^(?:en|english)$/i.test(targetLanguage.trim())) return translated;

  const phrase = /^(?:talita|talitha)\s+(?:kum|koum|kumi|cumi)([.!?]?)$/i;
  if (!phrase.test(original.trim()) || !phrase.test(translated.trim())) return translated;

  const punctuation = original.trim().match(phrase)?.[1] ?? '';
  return `Little girl, I say to you, get up${punctuation}`;
}

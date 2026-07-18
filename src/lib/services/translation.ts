import OpenAI from 'openai';
import { config } from '../config';
import type { LyricLine } from '@/lib/types';

const openai = config.openaiApiKey
  ? new OpenAI({ apiKey: config.openaiApiKey })
  : null;

const SYSTEM_PROMPT = `You are a music lyric translation engine. Your SOLE purpose is to translate song lyrics between languages. You are part of a music app called Melofy that helps people understand songs in any language.

CRITICAL: You are processing REAL song lyrics from real music tracks. The lyrics may be in ANY language including African languages (Bambara, Yoruba, Swahili, Wolof, etc.), Asian languages, European languages, or any other. NEVER refuse to translate. NEVER say you can't help. Your job is ONLY translation.

RULES:
1. Preserve the EXACT line count — output exactly one translated line per input line.
2. Preserve ALL timecodes (the [mm:ss.xx] prefix of each line).
3. Translate meaning faithfully. Understand slang, idioms, metaphors, and poetic structures.
4. Keep translations concise enough to fit on screen during playback.
5. If a line repeats in the original, repeat it in the translation.
6. Output ONLY the translated .lrc format. No explanations, no introductions, no notes.

Example input:
[00:12.50] 君は僕の光
[00:16.20] 暗い夜も照らしてくれる

Example output:
[00:12.50] You are my light
[00:16.20] Lighting up even the darkest nights`;

export async function translateLyrics(
  lyrics: LyricLine[],
  targetLanguage: string,
  artist?: string,
  title?: string
): Promise<{ translatedLyrics: LyricLine[]; sourceLanguage: string }> {
  if (!openai) {
    throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY in environment.');
  }

  const lrcFormat = lyrics
    .map((l) => {
      const min = Math.floor(l.timeMs / 60000);
      const sec = ((l.timeMs % 60000) / 1000).toFixed(2);
      const timestamp = `[${String(min).padStart(2, '0')}:${String(sec).padStart(5, '0')}]`;
      return `${timestamp}${l.original}`;
    })
    .join('\n');

  const songInfo = artist && title
    ? `Song: "${title}" by ${artist}\nTarget language: ${targetLanguage}`
    : `Target language: ${targetLanguage}`;

  const userMessage = `${songInfo}\n\n${lrcFormat}`;

  const maxInputChars = lrcFormat.length;
  const outputTokens = Math.max(4096, Math.ceil(maxInputChars * 1.5));

  try {
    const response = await openai.chat.completions.create({
      model: config.openaiModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: outputTokens,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from AI translation service');
    }

    console.log('[Translation] Raw response (first 200 chars):', content.slice(0, 200));

    if (isRefusalResponse(content)) {
      throw new Error('Content moderation blocked this translation. Try a different song.');
    }

    return parseTranslationResponse(content, lyrics);
  } catch (error) {
    console.error('[Translation] AI translation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to translate lyrics via AI';
    throw new Error(message);
  }
}

function parseTranslationResponse(
  content: string,
  originalLyrics: LyricLine[]
): { translatedLyrics: LyricLine[]; sourceLanguage: string } {
  const lines = content.trim().split('\n');
  const translatedLyrics: LyricLine[] = [];
  const lrcRegex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.+)/;

  for (let i = 0; i < originalLyrics.length; i++) {
    const original = originalLyrics[i];
    let translatedText = original.original;
    let foundMatch = false;

    for (const line of lines) {
      const match = line.match(lrcRegex);
      if (match) {
        const mm = parseInt(match[1], 10);
        const ss = parseInt(match[2], 10);
        const ms = parseInt(match[3].padEnd(3, '0'), 10);
        const lineTimeMs = mm * 60000 + ss * 1000 + ms;

        if (Math.abs(lineTimeMs - original.timeMs) < 500) {
          translatedText = match[4].trim();
          foundMatch = true;
          break;
        }
      }
    }

    if (!foundMatch) {
      const nonLrcLines = lines
        .filter((l) => !lrcRegex.test(l))
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (i < nonLrcLines.length) {
        translatedText = nonLrcLines[i];
      }
    }

    translatedLyrics.push({
      ...original,
      translated: translatedText,
    });
  }

  const sample = originalLyrics.map((l) => l.original).join(' ');
  let sourceLanguage = 'unknown';

  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(sample)) sourceLanguage = 'ja';
  else if (/[\uac00-\ud7af]/.test(sample)) sourceLanguage = 'ko';
  else if (/[\u4e00-\u9fff]/.test(sample)) sourceLanguage = 'zh';
  else if (/[\u0600-\u06ff]/.test(sample)) sourceLanguage = 'ar';
  else if (/[\u0400-\u04ff]/.test(sample)) sourceLanguage = 'ru';
  else if (/[\u0900-\u097f]/.test(sample)) sourceLanguage = 'hi';
  else if (/[áéíóúñü]/.test(sample)) sourceLanguage = 'es';
  else if (/[àâçèéêëîïôûùüÿ]/.test(sample)) sourceLanguage = 'fr';
  else sourceLanguage = 'en';

  return { translatedLyrics, sourceLanguage };
}

function isRefusalResponse(content: string): boolean {
  const refusalPatterns = [
    /i('m| am) sorry/i,
    /i (can'?t|cannot)\s+(assist|help|comply|fulfill|do that)/i,
    /i('m| am) (unable|not able)/i,
    /against\s+(my|our)\s+(content|usage|safety)\s+polic/i,
  ];
  const hasNoTimestamps = !/\[\d{2}:\d{2}\.\d{2,3}\]/.test(content);
  if (!hasNoTimestamps) return false;
  return refusalPatterns.some((p) => p.test(content));
}

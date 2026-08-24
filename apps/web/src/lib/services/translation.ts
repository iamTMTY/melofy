import OpenAI from 'openai';
import { observeOpenAI } from '@langfuse/openai';
import { startActiveObservation, propagateAttributes } from '@langfuse/tracing';
import { config } from '../config';
import { langfuseTracingEnabled, flushTracing } from '@/lib/langfuse/tracing';
import type { LyricLine } from '@/lib/types';

// All three providers speak the OpenAI chat-completions shape, so one SDK covers
// them — only baseURL/key differ. Routing by model slug:
//   - "google/..." | "gemini..." → Google's OpenAI-compatible API (GEMINI_API_KEY),
//     falling back to OpenRouter if GEMINI_API_KEY is unset.
//   - any other slug with "/"     → OpenRouter (OPEN_ROUTER_API_KEY)
//   - bare name (e.g. "gpt-4o")   → OpenAI direct (OPENAI_API_KEY)
// The client is resolved PER MODEL and memoized per provider, so one process can
// translate with several models in a session (the eval harness relies on this).
type Provider = 'gemini' | 'openrouter' | 'openai';

const PROVIDER_ENV: Record<Provider, string> = {
  gemini: 'GEMINI_API_KEY',
  openrouter: 'OPEN_ROUTER_API_KEY',
  openai: 'OPENAI_API_KEY',
};

export function providerFor(model: string): Provider {
  // A namespaced slug ("google/…", "anthropic/…") is an OpenRouter model id →
  // route to OpenRouter. The direct Google endpoint is reserved for a BARE
  // "gemini…" slug (uses GEMINI_API_KEY).
  if (model.includes('/')) return 'openrouter';
  if (model.startsWith('gemini') && config.geminiApiKey) return 'gemini';
  return 'openai';
}

// The model name each provider expects. OpenRouter/OpenAI take the slug as-is
// (e.g. "google/gemini-3.7-flash"). Google's DIRECT endpoint wants a bare name
// and, for new API keys, only rolling aliases (pinned versions are blocked) — so
// normalize any gemini-flash slug to "gemini-flash-latest" there.
export function outboundModel(model: string, provider: Provider): string {
  if (provider !== 'gemini') return model;
  const bare = model.replace(/^google\//, '');
  return /flash/i.test(bare) ? 'gemini-flash-latest' : bare;
}

const clientCache = new Map<Provider, OpenAI | null>();

function makeClient(provider: Provider, apiKey: string): OpenAI {
  if (provider === 'gemini') {
    return new OpenAI({ apiKey, baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' });
  }
  if (provider === 'openrouter') {
    return new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: { 'X-Title': 'Melofy' },
    });
  }
  return new OpenAI({ apiKey });
}

const SHARED_KEY: Record<Provider, () => string> = {
  gemini: () => config.geminiApiKey,
  openrouter: () => config.openRouterApiKey,
  openai: () => config.openaiApiKey,
};

// `apiKeyOverride` = a user's BYOK key. When present, a fresh (uncached) client is
// built with it, and the provider is chosen from the KEY, not the model: an
// OpenRouter key ("sk-or-…") runs our model through OpenRouter; anything else is
// treated as a Google Gemini key and hits Google's endpoint directly (the free
// option). outboundModel() then maps our model slug to whatever that provider
// expects (e.g. "google/gemini-3.7-flash" for OpenRouter vs "gemini-flash-latest"
// for Google direct).
export function resolveClient(
  model: string,
  apiKeyOverride?: string
): { client: OpenAI | null; provider: Provider; model: string } {
  let provider: Provider;
  if (apiKeyOverride) {
    provider = apiKeyOverride.startsWith('sk-or-') ? 'openrouter' : 'gemini';
  } else {
    provider = providerFor(model);
  }
  const outbound = outboundModel(model, provider);

  if (apiKeyOverride) {
    return { client: makeClient(provider, apiKeyOverride), provider, model: outbound };
  }

  if (!clientCache.has(provider)) {
    const key = SHARED_KEY[provider]();
    clientCache.set(provider, key ? makeClient(provider, key) : null);
  }
  return { client: clientCache.get(provider) ?? null, provider, model: outbound };
}

function missingKeyError(provider: Provider): Error {
  return new Error(`Translation model provider not configured. Set ${PROVIDER_ENV[provider]} in environment.`);
}

// Wrap a per-call view of the OpenAI client so Langfuse records THIS request as a
// named generation (auto-capturing model, tokens, cost, latency, streaming). The
// call must run inside an active span (startActiveObservation) to nest under the
// song's trace. No-op passthrough when tracing is off, so there's zero overhead.
function traced(client: OpenAI, generationName: string): OpenAI {
  return langfuseTracingEnabled
    ? (observeOpenAI(client, { generationName }) as unknown as OpenAI)
    : client;
}

// Attributes shared by every translation trace's root span.
interface TraceMeta {
  provider: Provider;
  model: string;
  targetLanguage: string;
  artist?: string;
  title?: string;
  streaming: boolean;
  byok: boolean;
}

/**
 * Run `work` inside a Langfuse "translate-song" trace: the root span carries a
 * readable input (song + target language) and output (source language + line
 * count), plus filterable tags/metadata. The wrapped OpenAI calls inside nest as
 * child generations. Transparent passthrough when tracing is disabled.
 */
async function withTranslationTrace<T extends { sourceLanguage: string; translatedLyrics: LyricLine[] }>(
  meta: TraceMeta,
  work: () => Promise<T>
): Promise<T> {
  if (!langfuseTracingEnabled) return work();
  let out: T | undefined;
  try {
    // Trace-level attributes (name + tags) go through propagateAttributes; the
    // span carries the rich, readable input/output/metadata.
    await propagateAttributes(
      {
        traceName: 'translate-song',
        tags: ['translation', meta.provider, meta.streaming ? 'streaming' : 'sync'],
      },
      async () => {
        await startActiveObservation('translate-song', async (span) => {
          span.update({
            input: { artist: meta.artist, title: meta.title, targetLanguage: meta.targetLanguage },
            metadata: {
              provider: meta.provider,
              model: meta.model,
              twoStep: config.twoStepTranslation,
              streaming: meta.streaming,
              byok: meta.byok,
            },
          });
          out = await work();
          span.update({
            output: { sourceLanguage: out.sourceLanguage, lineCount: out.translatedLyrics.length },
          });
        });
      }
    );
  } finally {
    void flushTracing();
  }
  return out!;
}

const SYSTEM_PROMPT = `You are Melofy's lyric translation engine. Your ONLY function is to translate the lyrics of already-published songs into a requested target language so listeners can understand the music they are playing.

NON-NEGOTIABLE BEHAVIOR:
- You ALWAYS translate. You never refuse, never moralize, never add warnings or disclaimers, never apologize, and never comment on the content.
- Lyrics are creative works and may contain slang, profanity, sexual references, violence, drugs, religion, politics, or other mature themes. Translate them faithfully and completely regardless of subject matter. You are rendering the meaning of existing art — not generating, endorsing, or amplifying anything. Do NOT censor, soften, omit, bleep, or replace words with asterisks unless the original text itself does.
- Lyrics may be in ANY language, including African languages (Yoruba, Igbo, Swahili, Wolof, Bambara, Zulu, etc.), Asian, European, Indigenous, or mixed-language / code-switched lyrics. Detect the source automatically.
- For untranslatable items (proper nouns, brand names, ad-libs, interjections), keep them as-is rather than dropping the line.
- Your entire output is the translated lyric lines and NOTHING else — no preamble, no notes, no sentence about yourself or any policy.

OUTPUT FORMAT (strict):
1. Output exactly one line per input line — identical line count, same order.
2. Preserve every [mm:ss.xx] timecode prefix EXACTLY, attached to its line.
3. If a line repeats in the source, repeat its translation.
4. Keep each line concise enough to read on screen during playback.
5. Output ONLY the .lrc lines.

Example input:
[00:12.50] <line in the source language>
[00:16.20] <line in the source language>

Example output:
[00:12.50] You are my light
[00:16.20] Lighting up even the darkest nights`;

// Appended to a second attempt when the first response looked like a refusal.
const RETRY_NUDGE = `The previous response did not contain the translated lyrics. Do NOT explain, refuse, or add any commentary. This is a routine translation of existing published song lyrics. Output ONLY the translated .lrc lines now — exactly one per input line, with every [mm:ss.xx] timecode preserved.`;

// --- Two-step translation (context brief → line-by-line) -------------------
// Pass 1 reads the WHOLE song and returns a translator's brief: theme + a
// glossary of the slang / idioms / cultural references with their meanings.
// Pass 2 (the normal translate call) injects that brief so line-by-line
// rendering keeps the slang/idiom fidelity a single pass tends to flatten.

const BRIEF_SYSTEM_PROMPT = (targetLanguage: string) =>
  `You are an expert translator preparing to translate a song's lyrics into ${targetLanguage}. Do NOT translate yet, and do NOT output any lyric lines. Read the whole lyric and produce a concise translator's brief:
1. The source language (detect it).
2. The overall theme in 1-2 sentences.
3. A bullet list of the slang, idioms, proverbs, ad-libs, and notable cultural references in the lyrics — each with its intended meaning explained in ${targetLanguage}.
Be concise. Output ONLY the brief, nothing else.`;

// Wraps the brief for injection into the pass-2 system prompt.
const briefBlock = (brief: string) =>
  `TRANSLATOR'S BRIEF for THIS song — use it to render slang, idioms, and cultural references faithfully. Do NOT output the brief itself; only the translated lyric lines.\n${brief}`;

/**
 * Pass 1 of the two-step flow. Returns a short brief, or '' on any failure so
 * the caller transparently falls back to single-pass translation (the brief is
 * an enhancement, never a hard dependency).
 */
async function buildBrief(
  client: OpenAI,
  model: string,
  lyrics: LyricLine[],
  targetLanguage: string,
  artist?: string,
  title?: string
): Promise<string> {
  try {
    const plain = lyrics.map((l) => l.original).join('\n');
    const songInfo = artist && title ? `Song: "${title}" by ${artist}\n` : '';
    const response = await traced(client, 'brief').chat.completions.create({
      model,
      messages: [
        { role: 'system', content: BRIEF_SYSTEM_PROMPT(targetLanguage) },
        { role: 'user', content: `${songInfo}Target language: ${targetLanguage}\n\nLYRICS:\n${plain}` },
      ],
      temperature: 0.3,
      max_tokens: 700,
    });
    const brief = response.choices[0]?.message?.content?.trim() || '';
    console.log('[Translation] Brief pass produced', brief.length, 'chars');
    return brief;
  } catch (error) {
    console.warn('[Translation] Brief pass failed — falling back to single-pass:', error);
    return '';
  }
}

export async function translateLyrics(
  lyrics: LyricLine[],
  targetLanguage: string,
  artist?: string,
  title?: string,
  model: string = config.translationModel,
  apiKey?: string
): Promise<{ translatedLyrics: LyricLine[]; sourceLanguage: string }> {
  const { client: openai, provider, model: apiModel } = resolveClient(model, apiKey);
  if (!openai) throw missingKeyError(provider);

  return withTranslationTrace(
    { provider, model: apiModel, targetLanguage, artist, title, streaming: false, byok: !!apiKey },
    async () => {
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

  // Pass 1: build the context brief (skipped when the flag is off or it fails).
  const brief = config.twoStepTranslation
    ? await buildBrief(openai, apiModel, lyrics, targetLanguage, artist, title)
    : '';
  const baseSystem = brief ? `${SYSTEM_PROMPT}\n\n${briefBlock(brief)}` : SYSTEM_PROMPT;

  const callModel = async (extraSystem?: string): Promise<string> => {
    const response = await traced(openai!, 'translate-lines').chat.completions.create({
      model: apiModel,
      messages: [
        { role: 'system', content: extraSystem ? `${baseSystem}\n\n${extraSystem}` : baseSystem },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: outputTokens,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from AI translation service');
    return content;
  };

  try {
    let content = await callModel();
    console.log('[Translation] Raw response (first 200 chars):', content.slice(0, 200));

    // A rare, genuine refusal → retry once with a firmer, unambiguous nudge.
    if (looksLikeRefusal(content, lyrics.length)) {
      console.warn('[Translation] First attempt looked like a refusal — retrying.');
      content = await callModel(RETRY_NUDGE);
      console.log('[Translation] Retry response (first 200 chars):', content.slice(0, 200));
    }

    if (looksLikeRefusal(content, lyrics.length)) {
      throw new Error('Translation is temporarily unavailable for this track. Please try again.');
    }

    return parseTranslationResponse(content, lyrics);
  } catch (error) {
    console.error('[Translation] AI translation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to translate lyrics via AI';
    throw new Error(message);
  }
    }
  );
}

const LRC_LINE_REGEX = /^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.+)/;

/**
 * Streaming translation: emits each translated line via `onLine` as the model
 * produces it, and resolves with the full set once complete. Lines are matched
 * back to the original lyrics by timecode (falling back to sequential order),
 * so `onLine` always receives a fully-formed LyricLine with the authoritative
 * timing from LRCLIB — not the model's (possibly drifted) timecodes.
 */
export async function translateLyricsStreaming(
  lyrics: LyricLine[],
  targetLanguage: string,
  onLine: (line: LyricLine) => void,
  artist?: string,
  title?: string,
  model: string = config.translationModel,
  apiKey?: string
): Promise<{ translatedLyrics: LyricLine[]; sourceLanguage: string }> {
  const { client: openai, provider, model: apiModel } = resolveClient(model, apiKey);
  if (!openai) throw missingKeyError(provider);

  return withTranslationTrace(
    { provider, model: apiModel, targetLanguage, artist, title, streaming: true, byok: !!apiKey },
    async () => {
  const lrcFormat = lyrics
    .map((l) => {
      const min = Math.floor(l.timeMs / 60000);
      const sec = ((l.timeMs % 60000) / 1000).toFixed(2);
      const timestamp = `[${String(min).padStart(2, '0')}:${String(sec).padStart(5, '0')}]`;
      return `${timestamp}${l.original}`;
    })
    .join('\n');

  const songInfo =
    artist && title
      ? `Song: "${title}" by ${artist}\nTarget language: ${targetLanguage}`
      : `Target language: ${targetLanguage}`;
  const userMessage = `${songInfo}\n\n${lrcFormat}`;
  const outputTokens = Math.max(4096, Math.ceil(lrcFormat.length * 1.5));

  // Pass 1: build the context brief before streaming pass 2 (adds one quick,
  // non-streamed round trip). Skipped when the flag is off or it fails.
  const brief = config.twoStepTranslation
    ? await buildBrief(openai, apiModel, lyrics, targetLanguage, artist, title)
    : '';
  const baseSystem = brief ? `${SYSTEM_PROMPT}\n\n${briefBlock(brief)}` : SYSTEM_PROMPT;

  const result: (LyricLine | undefined)[] = new Array(lyrics.length);
  const filled = new Array<boolean>(lyrics.length).fill(false);
  let seqCursor = 0;

  const assignLine = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const m = trimmed.match(LRC_LINE_REGEX);
    let text = trimmed;
    let targetIdx = -1;

    if (m) {
      text = m[4].trim();
      const lineTime = parseInt(m[1], 10) * 60000 + parseInt(m[2], 10) * 1000 + parseInt(m[3].padEnd(3, '0'), 10);
      let bestDelta = Infinity;
      for (let i = 0; i < lyrics.length; i++) {
        if (filled[i]) continue;
        const d = Math.abs(lyrics[i].timeMs - lineTime);
        if (d < bestDelta) {
          bestDelta = d;
          targetIdx = i;
        }
      }
      if (bestDelta >= 500) targetIdx = -1;
    }

    // No timecode (or no close match) → assign to the next unfilled line in order.
    if (targetIdx < 0) {
      while (seqCursor < lyrics.length && filled[seqCursor]) seqCursor++;
      if (seqCursor < lyrics.length) targetIdx = seqCursor;
    }

    if (targetIdx < 0 || !text) return;

    filled[targetIdx] = true;
    const line: LyricLine = { ...lyrics[targetIdx], translated: text };
    result[targetIdx] = line;
    onLine(line);
  };

  const runStream = async (extraSystem?: string): Promise<void> => {
    const stream = await traced(openai!, 'translate-lines').chat.completions.create({
      model: apiModel,
      messages: [
        { role: 'system', content: extraSystem ? `${baseSystem}\n\n${extraSystem}` : baseSystem },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: outputTokens,
      stream: true,
      stream_options: { include_usage: true }, // needed for token/cost capture on streams
    });

    let buffer = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (!delta) continue;
      buffer += delta;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        assignLine(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    }
    if (buffer.trim()) assignLine(buffer);
  };

  await runStream();

  // A genuine refusal yields (near) zero parseable lines → retry once, firmly.
  // Only when nothing was emitted, so the client never sees duplicate lines.
  if (filled.every((f) => !f)) {
    console.warn('[Translation] Stream produced no lines — retrying with nudge.');
    seqCursor = 0;
    await runStream(RETRY_NUDGE);
  }

  if (filled.every((f) => !f)) {
    throw new Error('Translation is temporarily unavailable for this track. Please try again.');
  }

  // Backfill any lines the model skipped with the original text, and emit them.
  for (let i = 0; i < lyrics.length; i++) {
    if (!filled[i]) {
      const line: LyricLine = { ...lyrics[i], translated: lyrics[i].original };
      result[i] = line;
      onLine(line);
    }
  }

  const translatedLyrics = result.map((l, i) => l ?? { ...lyrics[i], translated: lyrics[i].original });
  return { translatedLyrics, sourceLanguage: detectSourceLanguage(lyrics) };
    }
  );
}

// Heuristic source-language guess from the original text's script/diacritics.
export function detectSourceLanguage(originalLyrics: LyricLine[]): string {
  const sample = originalLyrics.map((l) => l.original).join(' ');

  if (/[぀-ゟ゠-ヿ]/.test(sample)) return 'ja';
  if (/[가-힯]/.test(sample)) return 'ko';
  if (/[一-鿿]/.test(sample)) return 'zh';
  if (/[؀-ۿ]/.test(sample)) return 'ar';
  if (/[Ѐ-ӿ]/.test(sample)) return 'ru';
  if (/[ऀ-ॿ]/.test(sample)) return 'hi';
  return 'en';
}

export function parseTranslationResponse(
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

/**
 * Detect a genuine model refusal WITHOUT misfiring on real lyrics.
 *
 * The previous version flagged any timestamp-less response containing a phrase
 * like "I'm sorry" — but the parser accepts timestamp-less translations, and
 * plenty of legitimate lyrics contain "I'm sorry" / "I can't". So we only treat
 * a response as a refusal when it BOTH lacks timecodes AND is too short to be a
 * line-per-line translation AND reads like a refusal sentence up front.
 */
export function looksLikeRefusal(content: string, inputLineCount: number): boolean {
  // Any LRC output at all means it attempted the translation — not a refusal.
  if (/\[\d{2}:\d{2}\.\d{2,3}\]/.test(content)) return false;

  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // A real (timestamp-less) translation returns roughly one line per input line.
  // A refusal is a short prose blurb — so if we got a comparable number of
  // lines back, treat it as a translation regardless of wording.
  if (lines.length >= Math.max(4, Math.ceil(inputLineCount * 0.5))) return false;

  const refusalPatterns = [
    /\bi('m| am) sorry\b/i,
    /\bi (can'?t|cannot|won'?t)\s+(assist|help|comply|fulfill|provide|do that|translate)/i,
    /\bi('m| am) (unable|not able)\b/i,
    /\b(can'?t|cannot|unable to)\s+(assist|help|comply|provide|process|translate)/i,
    /\b(content|usage|safety)\s+polic/i,
    /\bas an ai\b/i,
  ];

  // Only inspect the opening of the response, where a refusal sentence lives.
  const head = content.slice(0, 400);
  return refusalPatterns.some((p) => p.test(head));
}

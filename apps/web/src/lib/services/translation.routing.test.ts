import { describe, it, expect } from 'vitest';
import { providerFor, outboundModel, resolveClient } from './translation';

// Model → provider routing. No network: resolveClient only *constructs* an SDK
// client, it doesn't call it.
describe('providerFor', () => {
  it('routes any namespaced slug to OpenRouter', () => {
    expect(providerFor('google/gemini-3.7-flash')).toBe('openrouter');
    expect(providerFor('anthropic/claude-sonnet-5')).toBe('openrouter');
    expect(providerFor('openai/gpt-5.1')).toBe('openrouter');
  });

  it('routes a bare non-gemini name to OpenAI', () => {
    expect(providerFor('gpt-4o')).toBe('openai');
  });
});

describe('outboundModel', () => {
  it('leaves OpenRouter / OpenAI slugs untouched', () => {
    expect(outboundModel('google/gemini-3.7-flash', 'openrouter')).toBe('google/gemini-3.7-flash');
    expect(outboundModel('gpt-4o', 'openai')).toBe('gpt-4o');
  });

  it('normalizes a gemini-flash slug to the rolling alias for Google-direct', () => {
    // Google direct blocks pinned versions for new keys → use the alias.
    expect(outboundModel('google/gemini-3.7-flash', 'gemini')).toBe('gemini-flash-latest');
    expect(outboundModel('gemini-2.5-flash', 'gemini')).toBe('gemini-flash-latest');
  });
});

describe('resolveClient — BYOK provider chosen from the key prefix', () => {
  it('routes an OpenRouter key ("sk-or-…") through OpenRouter with our model id', () => {
    const r = resolveClient('google/gemini-3.7-flash', 'sk-or-v1-testkey');
    expect(r.provider).toBe('openrouter');
    expect(r.model).toBe('google/gemini-3.7-flash');
    expect(r.client).not.toBeNull();
  });

  it('treats any other key as a Google Gemini key → direct endpoint + rolling alias', () => {
    const r = resolveClient('google/gemini-3.7-flash', 'AIzaSyTestKey');
    expect(r.provider).toBe('gemini');
    expect(r.model).toBe('gemini-flash-latest');
    expect(r.client).not.toBeNull();
  });
});

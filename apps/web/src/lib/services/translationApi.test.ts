import { describe, it, expect } from 'vitest';
import { translateErrorBody } from './translationApi';

describe('translateErrorBody', () => {
  it('distinguishes a provider 429 from the daily free quota', () => {
    const { status, body } = translateErrorBody({ status: 429, message: 'Rate limited' });
    expect(status).toBe(429);
    expect(body.code).toBe('UPSTREAM_RATE_LIMIT');
    expect(body.error).not.toContain('free translations');
  });

  it('maps a 429 embedded in the error message', () => {
    const { status, body } = translateErrorBody(new Error('OpenRouter 429 Too Many Requests'));
    expect(status).toBe(429);
    expect(body.code).toBe('UPSTREAM_RATE_LIMIT');
  });

  it('maps anything else to a generic 500', () => {
    const { status, body } = translateErrorBody(new Error('boom'));
    expect(status).toBe(500);
    expect(body.error).toBe('Something went wrong translating this song.');
    expect(body.code).toBeUndefined();
  });
});

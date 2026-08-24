import { describe, it, expect } from 'vitest';
import { translateErrorBody } from './translationApi';

// Maps an internal/provider error to the client-facing status + body. A provider
// rate-limit (429) must surface as the friendly quota message, everything else as
// a generic 500 that never leaks internals.
describe('translateErrorBody', () => {
  it('maps a provider 429 (status field) to RATE_LIMIT 429', () => {
    const { status, body } = translateErrorBody({ status: 429, message: 'Rate limited' });
    expect(status).toBe(429);
    expect(body.code).toBe('RATE_LIMIT');
  });

  it('maps a 429 embedded in the error message', () => {
    const { status, body } = translateErrorBody(new Error('OpenRouter 429 Too Many Requests'));
    expect(status).toBe(429);
    expect(body.code).toBe('RATE_LIMIT');
  });

  it('maps anything else to a generic 500', () => {
    const { status, body } = translateErrorBody(new Error('boom'));
    expect(status).toBe(500);
    expect(body.error).toBe('Something went wrong translating this song.');
    expect(body.code).toBeUndefined();
  });
});

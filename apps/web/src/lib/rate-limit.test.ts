import { describe, it, expect } from 'vitest';
import type { NextRequest } from 'next/server';
import { getClientIp, anonymousId } from './rate-limit';

const req = (headers: Record<string, string>): NextRequest =>
  ({ headers: new Headers(headers) } as unknown as NextRequest);

describe('getClientIp', () => {
  it('takes the first x-forwarded-for entry', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4');
  });
  it('falls back to x-real-ip, then localhost', () => {
    expect(getClientIp(req({ 'x-real-ip': '9.8.7.6' }))).toBe('9.8.7.6');
    expect(getClientIp(req({}))).toBe('127.0.0.1');
  });
});

describe('anonymousId (privacy-preserving analytics/rate-limit id)', () => {
  it('is deterministic and never leaks the raw IP', () => {
    const r = req({ 'x-forwarded-for': '203.0.113.42' });
    const id = anonymousId(r);
    expect(id).toBe(anonymousId(r));
    expect(id).toMatch(/^ip_[0-9a-f]{32}$/);
    expect(id).not.toContain('203.0.113.42');
  });
  it('differs for different IPs', () => {
    expect(anonymousId(req({ 'x-forwarded-for': '1.1.1.1' }))).not.toBe(
      anonymousId(req({ 'x-forwarded-for': '2.2.2.2' }))
    );
  });
  it('collapses IPv6 to its /64 prefix (same prefix → same id)', () => {
    const a = anonymousId(req({ 'x-forwarded-for': '2001:db8:1:2:aaaa:bbbb:cccc:dddd' }));
    const b = anonymousId(req({ 'x-forwarded-for': '2001:db8:1:2:1111:2222:3333:4444' }));
    expect(a).toBe(b);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { config } from './config';
import { consumeTranslation } from './rate-limit';

const redis = vi.hoisted(() => ({ incr: vi.fn(), expire: vi.fn() }));
vi.mock('@/lib/db/redis', () => ({ getRedisClient: () => redis }));

const request = { headers: new Headers({ 'x-real-ip': '203.0.113.42' }) } as NextRequest;
const originalLimit = config.dailyTranslationLimit;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  config.dailyTranslationLimit = originalLimit;
});

describe('daily translation quota', () => {
  it('does not consume Redis quota in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    config.dailyTranslationLimit = 1;

    expect((await consumeTranslation(request)).allowed).toBe(true);
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it('still enforces the quota in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    config.dailyTranslationLimit = 1;
    redis.incr.mockResolvedValue(2);

    expect((await consumeTranslation(request)).allowed).toBe(false);
    expect(redis.incr).toHaveBeenCalledOnce();
  });
});

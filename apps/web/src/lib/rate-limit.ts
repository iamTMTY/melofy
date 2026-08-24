import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { getRedisClient } from '@/lib/db/redis';
import { config } from '@/lib/config';

// Per-IP daily limit on NEW translations (a cache miss that actually calls the
// model). Cache hits and "no lyrics" never reach here, so they never count.
// No auth: identity is the client IP, hashed for privacy.

export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() || '127.0.0.1';
}

function hashIp(ip: string): string {
  // Collapse IPv6 to its /64 prefix so trivial address rotation within a prefix
  // can't dodge the limit. Then hash with a salt — we never store the raw IP.
  const norm = ip.includes(':') ? ip.split(':').slice(0, 4).join(':') + '::/64' : ip;
  return crypto.createHash('sha256').update(norm + config.rateLimitSalt).digest('hex').slice(0, 32);
}

/**
 * A stable, anonymous per-caller id for analytics — the SAME hashed-IP value the
 * rate limiter keys on, so we never send a raw IP to PostHog. Not tied to any
 * account (there are none).
 */
export function anonymousId(req: NextRequest): string {
  return `ip_${hashIp(getClientIp(req))}`;
}

function utcDateStamp(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function nextUtcMidnight(): number {
  const n = new Date();
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number; // epoch ms of next UTC midnight
}

/**
 * Consume one unit of the caller's daily translation budget. Call this only when
 * about to perform a NEW translation. Atomic (Redis INCR). Fails OPEN on any
 * Redis error — a provider-level quota is the hard backstop, and we'd rather not
 * block real users over an infra blip.
 */
export async function consumeTranslation(req: NextRequest): Promise<RateLimitResult> {
  const limit = config.dailyTranslationLimit;
  const resetAt = nextUtcMidnight();
  if (!limit || limit <= 0) return { allowed: true, remaining: Number.POSITIVE_INFINITY, limit: 0, resetAt };

  try {
    const redis = getRedisClient();
    const key = `rl:trans:${hashIp(getClientIp(req))}:${utcDateStamp()}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60 * 60 * 48); // 48h GC; the date-stamped key resets daily
    if (count > limit) return { allowed: false, remaining: 0, limit, resetAt };
    return { allowed: true, remaining: limit - count, limit, resetAt };
  } catch (err) {
    console.warn('[rate-limit] Redis error — failing open:', err);
    return { allowed: true, remaining: limit, limit, resetAt };
  }
}

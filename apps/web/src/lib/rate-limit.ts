import crypto from 'crypto';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRedisClient } from '@/lib/db/redis';
import { config } from '@/lib/config';

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

export function anonymousId(req: NextRequest): string {
  return `ip_${hashIp(getClientIp(req))}`;
}

function utcDateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextUtcMidnight(): number {
  const n = new Date();
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

export async function consumeTranslation(req: NextRequest): Promise<RateLimitResult> {
  const limit = config.dailyTranslationLimit;
  const resetAt = nextUtcMidnight();
  if (!limit || limit <= 0) return { allowed: true, remaining: Number.POSITIVE_INFINITY, limit: 0, resetAt };

  try {
    const redis = getRedisClient();
    const key = `rl:trans:${hashIp(getClientIp(req))}:${utcDateStamp()}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60 * 60 * 48);
    if (count > limit) return { allowed: false, remaining: 0, limit, resetAt };
    return { allowed: true, remaining: limit - count, limit, resetAt };
  } catch (err) {
    console.warn('[rate-limit] Redis error — failing open:', err);
    return { allowed: true, remaining: limit, limit, resetAt };
  }
}

export interface RateLimitOptions {
  bucket: string;
  limit: number;
  windowSec: number;
}

export async function enforceRateLimit(
  req: NextRequest,
  { bucket, limit, windowSec }: RateLimitOptions
): Promise<NextResponse | null> {
  if (!limit || limit <= 0) return null;
  try {
    const redis = getRedisClient();
    const nowSec = Math.floor(Date.now() / 1000);
    const window = Math.floor(nowSec / windowSec);
    const key = `rl:${bucket}:${hashIp(getClientIp(req))}:${window}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSec);
    if (count > limit) {
      const retryAfter = windowSec - (nowSec % windowSec);
      return NextResponse.json(
        { error: 'Too many requests. Please slow down and try again shortly.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }
    return null;
  } catch (err) {
    console.warn('[rate-limit] Redis error — failing open:', err);
    return null;
  }
}

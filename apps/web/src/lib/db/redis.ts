import Redis from 'ioredis';
import { config } from '../config';

declare global {
  var _redisClient: Redis | null;
}

global._redisClient = global._redisClient || null;

export function getRedisClient(): Redis {
  if (!global._redisClient) {
    global._redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    global._redisClient.on('connect', () => console.log('[Redis] Connected'));
    global._redisClient.on('error', (err) => console.error('[Redis] Error:', err.message));
  }
  return global._redisClient;
}

export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  await client.connect();
}

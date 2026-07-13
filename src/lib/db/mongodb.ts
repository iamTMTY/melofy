import mongoose from 'mongoose';
import { config } from '../config';

declare global {
  var _mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

global._mongooseCache = global._mongooseCache || { conn: null, promise: null };

let listenersAttached = false;

export async function connectMongoDB(): Promise<void> {
  if (global._mongooseCache.conn) {
    return;
  }

  if (!global._mongooseCache.promise) {
    global._mongooseCache.promise = mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
  }

  global._mongooseCache.conn = await global._mongooseCache.promise;
  console.log('[MongoDB] Connected successfully');

  if (!listenersAttached) {
    listenersAttached = true;
    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Runtime error:', err.message);
    });
    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Disconnected');
    });
  }
}

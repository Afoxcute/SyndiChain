/**
 * Redis-backed session store with in-memory fallback.
 * When REDIS_URL is set, sessions survive server restarts.
 * Without it, falls back to the in-memory Map (dev mode).
 */

import type { SwarmSession } from './types';

const KEY_PREFIX = 'syndichain:session:';
const INDEX_KEY  = 'syndichain:sessions';
const TTL_SECS   = 60 * 60 * 24; // 24 hours

// Lazy singleton — only created when REDIS_URL is present
let _redis: import('ioredis').Redis | null = null;

async function getRedis(): Promise<import('ioredis').Redis | null> {
  if (!process.env.REDIS_URL) return null;
  if (_redis) return _redis;
  const { default: Redis } = await import('ioredis');
  _redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });
  _redis.on('error', (err) => console.error('[redis] connection error:', err.message));
  return _redis;
}

export async function saveSession(session: SwarmSession): Promise<void> {
  const r = await getRedis();
  if (!r) return;
  try {
    const key = `${KEY_PREFIX}${session.id}`;
    await r.set(key, JSON.stringify(session), 'EX', TTL_SECS);
    await r.zadd(INDEX_KEY, session.startedAt, session.id);
    await r.expire(INDEX_KEY, TTL_SECS);
  } catch (err: any) {
    console.error('[redis] saveSession error:', err.message);
  }
}

export async function loadSession(id: string): Promise<SwarmSession | null> {
  const r = await getRedis();
  if (!r) return null;
  try {
    const data = await r.get(`${KEY_PREFIX}${id}`);
    return data ? (JSON.parse(data) as SwarmSession) : null;
  } catch (err: any) {
    console.error('[redis] loadSession error:', err.message);
    return null;
  }
}

export async function loadAllSessions(): Promise<SwarmSession[]> {
  const r = await getRedis();
  if (!r) return [];
  try {
    const ids = await r.zrevrange(INDEX_KEY, 0, 9);
    if (!ids.length) return [];
    const pipeline = r.pipeline();
    ids.forEach((id) => pipeline.get(`${KEY_PREFIX}${id}`));
    const results = await pipeline.exec();
    return (results ?? [])
      .map(([err, data]) => (!err && data ? (JSON.parse(data as string) as SwarmSession) : null))
      .filter(Boolean) as SwarmSession[];
  } catch (err: any) {
    console.error('[redis] loadAllSessions error:', err.message);
    return [];
  }
}

import { redis } from './redis';

export async function getCache<T = any>(key: string): Promise<T | null> {
  const cached = await redis.get(key);
  if (!cached) return null;
  try {
    return (typeof cached === 'string' ? JSON.parse(cached) : cached) as T;
  } catch {
    await redis.del(key);
    return null;
  }
}

export async function setCache(key: string, value: any, ttlSeconds: number) {
  await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
}

export async function delCache(key: string) {
  await redis.del(key);
}

export async function clearAllCache() {
  await redis.flushdb();
}
import { redis } from './redis';

// Export all cache keys here for reuse
export const CACHE_KEYS = {
  STOPS_LIST: process.env.STOPS_CACHE_KEY,
  TICKET_TYPES : process.env.TICKET_TYPES_LIST,
  DASHBOARD : process.env.DASHBOARD_CACHE_KEY,
  
  ROUTES : process.env.ROUTES_CACHE_KEY,
  ROUTES_FULL : process.env.ROUTES_FULL_CACHE_KEY, 

  DRIVERS : process.env.DRIVERS_CACHE_KEY,
  DRIVERS_ALL : process.env.DRIVERS_CACHE_KEY_ALL,

  CONDUCTORS : process.env.CONDUCTORS_CACHE_KEY,
  CONDUCTORS_ALL : process.env.CONDUCTORS_CACHE_KEY_ALL,

  BUSES : process.env.BUSES_CACHE_KEY,
  BUSES_ALL : process.env.BUSES_CACHE_KEY_ALL,

  BUS_ASSIGNMENTS : process.env.BUS_ASSIGNMENTS_CACHE_KEY,

  BUS_OPERATIONS_ALL: process.env.BUS_OPERATIONS_CACHE_KEY_ALL,
  BUS_OPERATIONS_NOTREADY: process.env.BUS_OPERATIONS_CACHE_KEY_NOTREADY,
  BUS_OPERATIONS_NOTSTARTED: process.env.BUS_OPERATIONS_CACHE_KEY_NOTSTARTED,
  BUS_OPERATIONS_INOPERATION: process.env.BUS_OPERATIONS_CACHE_KEY_INOPERATION,

};

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

export async function setCache(key: string, value: any, ttlSeconds: number = 3600) {
  await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
}

export async function delCache(key: string) {
  await redis.del(key);
}

export async function clearAllCache() {
  await redis.flushdb();
}


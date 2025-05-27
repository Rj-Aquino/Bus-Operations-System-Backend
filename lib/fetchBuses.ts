import { redis } from '@/lib/redis';

const TTL_SECONDS = 60 * 60; // 1 hour cache
const GLOBAL_CACHE_KEY = 'buses_data';

function getSupabaseHeaders() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

export async function fetchBuses() {
  // 1. Try global cache
  const cached = await redis.get(GLOBAL_CACHE_KEY);
  if (cached && typeof cached === 'string') {
    try {
      return JSON.parse(cached);
    } catch {
      await redis.del(GLOBAL_CACHE_KEY); // Remove bad cache
    }
  }

  // 2. Fallback: fetch from Supabase
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buses`;
  const res = await fetch(url, { headers: getSupabaseHeaders() });

  if (!res.ok) {
    throw new Error(`Failed to fetch buses: ${res.status} ${res.statusText}`);
  }

  const freshData = await res.json();

  // 3. Cache fresh data
  await redis.set(GLOBAL_CACHE_KEY, JSON.stringify(freshData), { ex: TTL_SECONDS });

  return freshData;
}

export async function fetchBusById(busId: string) {
  const individualCacheKey = `bus_data_${busId}`;

  // 1. Try individual cache
  const cached = await redis.get(individualCacheKey);
  if (cached && typeof cached === 'string') {
    try {
      return JSON.parse(cached);
    } catch {
      await redis.del(individualCacheKey); // Remove corrupt cache
    }
  }

  // 2. Try global cache
  const allBusesCache = await redis.get(GLOBAL_CACHE_KEY);
  if (allBusesCache && typeof allBusesCache === 'string') {
    try {
      const buses = JSON.parse(allBusesCache);
      const bus = buses.find((b: any) => b.busId === busId);
      if (bus) {
        await redis.set(individualCacheKey, JSON.stringify(bus), { ex: TTL_SECONDS });
        return bus;
      }
    } catch {
      await redis.del(GLOBAL_CACHE_KEY); // Corrupt global cache
    }
  }

  // 3. Fallback: fetch from Supabase
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buses?busId=eq.${encodeURIComponent(busId)}`;
  const res = await fetch(url, { headers: getSupabaseHeaders() });

  if (!res.ok) {
    throw new Error(`Failed to fetch bus with ID ${busId}: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const bus = data.length > 0 ? data[0] : null;

  if (bus) {
    await redis.set(individualCacheKey, JSON.stringify(bus), { ex: TTL_SECONDS });
  }

  return bus;
}

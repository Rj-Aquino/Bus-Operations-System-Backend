import { redis } from '@/lib/redis';

const TTL_SECONDS = 60 * 60; // 1 hour cache
const CACHE_KEY_ALL = 'drivers_data';

function getSupabaseHeaders() {
  return {
    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  };
}

export async function fetchDrivers() {
  // 1. Try cache
  const cached = await redis.get(CACHE_KEY_ALL);
  if (cached && typeof cached === 'string') {
    try {
      return JSON.parse(cached);
    } catch {
      await redis.del(CACHE_KEY_ALL);
    }
  }

  // 2. Fetch from Supabase
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/drivers`;
  const res = await fetch(url, { headers: getSupabaseHeaders() });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('Supabase error body:', errorBody);
    throw new Error(`Failed to fetch drivers: ${res.status} ${res.statusText}`);
  }

  const freshData = await res.json();

  // 3. Cache result
  await redis.set(CACHE_KEY_ALL, JSON.stringify(freshData), { ex: TTL_SECONDS });

  return freshData;
}

export async function fetchDriverById(driverId: string) {
  const individualKey = `driver_data_${driverId}`;

  // 1. Try individual cache
  const cached = await redis.get(individualKey);
  if (cached && typeof cached === 'string') {
    try {
      return JSON.parse(cached);
    } catch {
      await redis.del(individualKey);
    }
  }

  // 2. Try global cache
  const allDriversCache = await redis.get(CACHE_KEY_ALL);
  if (allDriversCache && typeof allDriversCache === 'string') {
    try {
      const drivers = JSON.parse(allDriversCache);
      const driver = drivers.find((d: any) => d.driver_id === driverId);
      if (driver) {
        await redis.set(individualKey, JSON.stringify(driver), { ex: TTL_SECONDS });
        return driver;
      }
    } catch {
      await redis.del(CACHE_KEY_ALL);
    }
  }

  // 3. Fallback to Supabase
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/drivers?driver_id=eq.${encodeURIComponent(driverId)}`;
  const res = await fetch(url, { headers: getSupabaseHeaders() });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('Supabase error body:', errorBody);
    throw new Error(`Failed to fetch driver with ID ${driverId}: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const driver = data.length > 0 ? data[0] : null;

  // 4. Cache result
  if (driver) {
    await redis.set(individualKey, JSON.stringify(driver), { ex: TTL_SECONDS });
  }

  return driver;
}

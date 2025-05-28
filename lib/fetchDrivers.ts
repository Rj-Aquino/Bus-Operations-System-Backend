import { redis } from '@/lib/redis';

const TTL_SECONDS = 60 * 60; // 1 hour cache
const CACHE_KEY_ALL = 'drivers_data';

function getSupabaseHeaders() {
  return {
    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  };
}

export async function fetchDrivers() {
  const cached = await redis.get(CACHE_KEY_ALL);
  if (cached && typeof cached === 'string') {
    try {
      return JSON.parse(cached);
    } catch {
      await redis.del(CACHE_KEY_ALL);
    }
  }

  // Fetch only selected fields from Supabase
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/drivers?select=driver_id,name,contactNo,address`;
  const res = await fetch(url, { headers: getSupabaseHeaders() });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('Supabase error body:', errorBody);
    throw new Error(`Failed to fetch drivers: ${res.status} ${res.statusText}`);
  }

  const freshData = await res.json();

  await redis.set(CACHE_KEY_ALL, JSON.stringify(freshData), { ex: TTL_SECONDS });

  return freshData;
}

export async function fetchDriverById(driverId: string) {
  // 1. Try global cache
  const allDriversCache = await redis.get(CACHE_KEY_ALL);
  if (allDriversCache && typeof allDriversCache === 'string') {
    try {
      const drivers = JSON.parse(allDriversCache);
      const driver = drivers.find((d: any) => d.driver_id === driverId);
      if (driver && driver.name) {
        return { name: driver.name };
      }
    } catch {
      await redis.del(CACHE_KEY_ALL); // Corrupt global cache
    }
  }

  // 2. Fallback to Supabase (name only)
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/drivers?driver_id=eq.${encodeURIComponent(driverId)}&select=driver_id,name`;
  const res = await fetch(url, { headers: getSupabaseHeaders() });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('Supabase error body:', errorBody);
    throw new Error(`Failed to fetch driver name for ID ${driverId}: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.length > 0 ? data[0] : null;
}
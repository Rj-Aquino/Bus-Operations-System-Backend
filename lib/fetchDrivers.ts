import { redis } from '@/lib/redis';

const CACHE_KEY_ALL_DRIVERS = 'drivers_data';
const TTL_SECONDS = 60 * 60; // 1 hour cache

export async function fetchDrivers() {
  // Try to get cached data
  const cached = await redis.get(CACHE_KEY_ALL_DRIVERS);
  if (cached !== null && typeof cached === 'string') {
    return JSON.parse(cached);
  }

  // If no cache, fetch fresh data from Supabase
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/drivers`;

  const res = await fetch(url, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch drivers: ${res.statusText}`);
  }

  const freshData = await res.json();

  // Cache fresh data in Redis
  await redis.set(CACHE_KEY_ALL_DRIVERS, JSON.stringify(freshData), { ex: TTL_SECONDS });

  return freshData;
}

export async function fetchDriverById(driverId: string) {
  const CACHE_KEY = `driver_data_${driverId}`;

  // Try cache first
  const cached = await redis.get(CACHE_KEY);
  if (cached !== null && typeof cached === 'string') {
    return JSON.parse(cached);
  }

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/drivers?driver_id=eq.${encodeURIComponent(driverId)}`;

  const res = await fetch(url, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch driver: ${res.statusText}`);
  }

  const drivers = await res.json();
  const driver = drivers.length > 0 ? drivers[0] : null;

  // Cache the result if found
  if (driver) {
    await redis.set(CACHE_KEY, JSON.stringify(driver), { ex: TTL_SECONDS });
  }

  return driver;
}

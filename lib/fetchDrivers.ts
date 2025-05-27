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

  // 1. Try individual driver cache
  const cached = await redis.get(CACHE_KEY);
  if (cached && typeof cached === 'string') {
    return JSON.parse(cached);
  }

  // 2. Try searching from cached list of all drivers
  const allDriversCache = await redis.get('drivers_data');
  if (allDriversCache && typeof allDriversCache === 'string') {
    const drivers = JSON.parse(allDriversCache);
    const driver = drivers.find((d: any) => d.driver_id === driverId);

    if (driver) {
      // Cache individually for future quick access
      await redis.set(CACHE_KEY, JSON.stringify(driver), { ex: TTL_SECONDS });
      return driver;
    }
  }

  // 3. Fallback to Supabase fetch if not found in any cache
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

  // 4. Cache it individually if found
  if (driver) {
    await redis.set(CACHE_KEY, JSON.stringify(driver), { ex: TTL_SECONDS });
  }

  return driver;
}

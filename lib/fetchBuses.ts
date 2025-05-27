import { redis } from '@/lib/redis';

const CACHE_KEY = 'buses_data';
const TTL_SECONDS = 60 * 60; // 1 hour cache

export async function fetchBuses() {
  // Try to get cached data
  const cached = await redis.get(CACHE_KEY);
  if (cached !== null && typeof cached === 'string') {
    return JSON.parse(cached); // Redis returns strings, so parse it
  }

  // If no cache, fetch fresh data from Supabase
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buses`;

  const res = await fetch(url, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch buses: ${res.statusText}`);
  }

  const freshData = await res.json();

  // Cache fresh data in Redis
  await redis.set(CACHE_KEY, JSON.stringify(freshData), { ex: TTL_SECONDS });

  return freshData;
}

export async function fetchBusById(busId: string) {
  const CACHE_KEY = `bus_data_${busId}`;

  // 1. Try individual bus cache
  const cached = await redis.get(CACHE_KEY);
  if (cached && typeof cached === 'string') {
    return JSON.parse(cached);
  }

  // 2. Try from global cache of all buses
  const allBusesCache = await redis.get('buses_data');
  if (allBusesCache && typeof allBusesCache === 'string') {
    const buses = JSON.parse(allBusesCache);
    const bus = buses.find((b: any) => b.busId === busId);

    if (bus) {
      // Cache individually for future access
      await redis.set(CACHE_KEY, JSON.stringify(bus), { ex: TTL_SECONDS });
      return bus;
    }
  }

  // 3. Fallback to Supabase if not found in cache
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buses?busId=eq.${encodeURIComponent(busId)}`;

  const res = await fetch(url, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch bus with ID ${busId}: ${res.statusText}`);
  }

  const data = await res.json();
  const bus = data.length > 0 ? data[0] : null;

  // 4. Cache the bus individually
  if (bus) {
    await redis.set(CACHE_KEY, JSON.stringify(bus), { ex: TTL_SECONDS });
  }

  return bus;
}
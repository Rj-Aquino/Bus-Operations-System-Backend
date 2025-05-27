import { redis } from '@/lib/redis';

const CACHE_KEY_ALL = 'conductors_data';
const TTL_SECONDS = 60 * 60; // 1 hour cache

export async function fetchConductors() {
  // Try to get cached data
  const cached = await redis.get(CACHE_KEY_ALL);
  if (cached !== null && typeof cached === 'string') {
    return JSON.parse(cached);
  }

  // If no cache, fetch fresh data from Supabase
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/conductors`;

  const res = await fetch(url, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      // Authorization header removed to avoid conflicts
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('Supabase error body:', errorBody);
    throw new Error(`Failed to fetch conductors: ${res.status} ${res.statusText}`);
  }

  const freshData = await res.json();

  // Cache fresh data in Redis
  await redis.set(CACHE_KEY_ALL, JSON.stringify(freshData), { ex: TTL_SECONDS });

  return freshData;
}

export async function fetchConductorById(conductorId: string) {
  const CACHE_KEY = `conductor_data_${conductorId}`;

  // 1. Try individual cache
  const cached = await redis.get(CACHE_KEY);
  if (cached && typeof cached === 'string') {
    return JSON.parse(cached);
  }

  // 2. Try global conductors cache
  const allConductorsCache = await redis.get('conductors_data');
  if (allConductorsCache && typeof allConductorsCache === 'string') {
    const conductors = JSON.parse(allConductorsCache);
    const conductor = conductors.find((c: any) => c.conductor_id === conductorId);

    if (conductor) {
      await redis.set(CACHE_KEY, JSON.stringify(conductor), { ex: TTL_SECONDS });
      return conductor;
    }
  }

  // 3. Fallback: Fetch from Supabase
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/conductors?conductor_id=eq.${encodeURIComponent(conductorId)}`;

  console.log('Fetching from URL:', url);

  const res = await fetch(url, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('Supabase error body:', errorBody);
    throw new Error(`Failed to fetch conductor with ID ${conductorId}: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const conductor = data.length > 0 ? data[0] : null;

  if (conductor) {
    await redis.set(CACHE_KEY, JSON.stringify(conductor), { ex: TTL_SECONDS });
  }

  return conductor;
}
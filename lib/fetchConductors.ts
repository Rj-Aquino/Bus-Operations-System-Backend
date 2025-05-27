import { redis } from '@/lib/redis';

const TTL_SECONDS = 60 * 60; // 1 hour cache
const CACHE_KEY_ALL = 'conductors_data';

function getSupabaseHeaders() {
  return {
    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  };
}

export async function fetchConductors() {
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
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/conductors`;
  const res = await fetch(url, { headers: getSupabaseHeaders() });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('Supabase error body:', errorBody);
    throw new Error(`Failed to fetch conductors: ${res.status} ${res.statusText}`);
  }

  const freshData = await res.json();

  // 3. Cache result
  await redis.set(CACHE_KEY_ALL, JSON.stringify(freshData), { ex: TTL_SECONDS });

  return freshData;
}

export async function fetchConductorById(conductorId: string) {
  const individualKey = `conductor_data_${conductorId}`;

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
  const globalCached = await redis.get(CACHE_KEY_ALL);
  if (globalCached && typeof globalCached === 'string') {
    try {
      const conductors = JSON.parse(globalCached);
      const conductor = conductors.find((c: any) => c.conductor_id === conductorId);
      if (conductor) {
        await redis.set(individualKey, JSON.stringify(conductor), { ex: TTL_SECONDS });
        return conductor;
      }
    } catch {
      await redis.del(CACHE_KEY_ALL);
    }
  }

  // 3. Fetch from Supabase
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/conductors?conductor_id=eq.${encodeURIComponent(conductorId)}`;
  const res = await fetch(url, { headers: getSupabaseHeaders() });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('Supabase error body:', errorBody);
    throw new Error(`Failed to fetch conductor with ID ${conductorId}: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const conductor = data.length > 0 ? data[0] : null;

  if (conductor) {
    await redis.set(individualKey, JSON.stringify(conductor), { ex: TTL_SECONDS });
  }

  return conductor;
}

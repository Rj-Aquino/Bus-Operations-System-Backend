import { redis } from '@/lib/redis';

const TTL_SECONDS = 60 * 60; // 1 hour cache
const CACHE_KEY_ALL = 'conductors_data';

function getSupabaseHeaders() {
  return {
    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  };
}

export async function fetchConductors() {

  const cached = await redis.get(CACHE_KEY_ALL);
  if (cached && typeof cached === 'string') {
    try {
      return JSON.parse(cached);
    } catch {
      await redis.del(CACHE_KEY_ALL);
    }
  }

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/conductors?select=conductor_id,name,contactNo,address`;
  const res = await fetch(url, { headers: getSupabaseHeaders() });

  if (!res.ok) {
    throw new Error(`Failed to fetch conductors: ${res.status} ${res.statusText}`);
  }

  const freshData = await res.json();

  await redis.set(CACHE_KEY_ALL, JSON.stringify(freshData), { ex: TTL_SECONDS });

  return freshData;
}

export async function fetchConductorById(conductorId: string) {
  // 1. Try global cache
  const globalCached = await redis.get(CACHE_KEY_ALL);
  if (globalCached && typeof globalCached === 'string') {
    try {
      const conductors = JSON.parse(globalCached);
      const conductor = conductors.find((c: any) => c.conductor_id === conductorId);
      if (conductor && conductor.name) {
        return { name: conductor.name };
      }
    } catch {
      await redis.del(CACHE_KEY_ALL); // Corrupt global cache
    }
  }

  // 2. Fallback: fetch only the name from Supabase
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/conductors?conductor_id=eq.${encodeURIComponent(conductorId)}&select=conductor_id,name`;
  const res = await fetch(url, { headers: getSupabaseHeaders() });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('Supabase error body:', errorBody);
    throw new Error(`Failed to fetch conductor name for ID ${conductorId}: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.length > 0 ? data[0] : null;
}

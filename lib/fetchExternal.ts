function getSupabaseHeaders() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

export async function fetchBuses() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buses?select=busId,route,type,capacity,license_plate`;
  const res = await fetch(url, { headers: getSupabaseHeaders() });

  if (!res.ok) {
    throw new Error(`Failed to fetch buses: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}

export async function fetchDrivers() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/drivers?select=driver_id,name,contactNo,address`;
  const res = await fetch(url, { headers: getSupabaseHeaders() });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('Supabase error body:', errorBody);
    throw new Error(`Failed to fetch drivers: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}

export async function fetchConductors() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/conductors?select=conductor_id,name,contactNo,address`;
  const res = await fetch(url, { headers: getSupabaseHeaders() });

  if (!res.ok) {
    throw new Error(`Failed to fetch conductors: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}
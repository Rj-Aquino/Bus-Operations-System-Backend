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

export async function fetchNewBuses() {
  const res = await fetch(process.env.BUS_URL as string);

  console.log('Fetching new buses from:', process.env.BUS_URL);
  console.log('Response status:', res);
  
  if (!res.ok) throw new Error('Failed to fetch buses');
  return res.json();
}

export async function fetchNewDrivers() {
  const res = await fetch(process.env.DRIVER_URL as string);
  if (!res.ok) throw new Error('Failed to fetch drivers');
  return res.json();
}

export async function fetchNewConductors() {
  const res = await fetch(process.env.CONDUCTOR_URL as string);
  if (!res.ok) throw new Error('Failed to fetch conductors');
  return res.json();
}


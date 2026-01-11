async function fetchWithTimeout(url: string, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

export async function fetchNewBuses() {
  try {
    const res = await fetchWithTimeout(process.env.BUS_URL as string);

    console.log('Fetching new buses from:', process.env.BUS_URL);
    console.log('Response status:', res.status);

    if (!res.ok) throw new Error('Failed to fetch buses');
    return await res.json();

  } catch (error) {
    console.error("Bus API unavailable or timed out, falling back:", error);
    return await fetchBuses();
  }
}

export async function fetchNewDrivers() {
  try {
    const res = await fetchWithTimeout(process.env.DRIVER_URL as string);

    if (!res.ok) throw new Error('Failed to fetch drivers');
    const data = await res.json();
    return data.employees || []; // Extract the employees array

  } catch (error) {
    console.error("Driver API unavailable or timed out, falling back:", error);
    return await fetchDrivers();
  }
}

export async function fetchNewConductors() {
  try {
    const res = await fetchWithTimeout(process.env.CONDUCTOR_URL as string);

    if (!res.ok) throw new Error('Failed to fetch conductors');
    const data = await res.json();
    return data.employees || []; // or data.conductors, depending on your API
  } catch (error) {
    console.error("Conductor API unavailable or timed out, falling back:", error);
    return await fetchConductors();
  }
}

function getSupabaseHeaders() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

export async function fetchBuses() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buses?select=bus_id,bus_type,seat_capacity,plate_number`;
  const res = await fetch(url, { headers: getSupabaseHeaders() });

  if (!res.ok) {
    throw new Error(`Failed to fetch buses: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}

export async function fetchDrivers() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/drivers?select=employeeNumber,firstName,middleName,lastName,phone,barangay,zipCode`;
  const res = await fetch(url, { headers: getSupabaseHeaders() });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('Supabase error body:', errorBody);
    throw new Error(`Failed to fetch drivers: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}

export async function fetchConductors() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/conductors?select=employeeNumber,firstName,middleName,lastName,phone,barangay,zipCode`;
  const res = await fetch(url, { headers: getSupabaseHeaders() });

  if (!res.ok) {
    throw new Error(`Failed to fetch conductors: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}
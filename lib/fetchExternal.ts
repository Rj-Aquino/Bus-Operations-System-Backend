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
    console.error("Bus API unavailable or timed out:", error);
    return []; // fallback empty
  }
}

export async function fetchNewDrivers() {
  try {
    const res = await fetchWithTimeout(process.env.DRIVER_URL as string);

    if (!res.ok) throw new Error('Failed to fetch drivers');
    return await res.json();
  } catch (error) {
    console.error("Driver API unavailable or timed out:", error);
    return [];
  }
}

export async function fetchNewConductors() {
  try {
    const res = await fetchWithTimeout(process.env.CONDUCTOR_URL as string);

    if (!res.ok) throw new Error('Failed to fetch conductors');
    return await res.json();
  } catch (error) {
    console.error("Conductor API unavailable or timed out:", error);
    return [];
  }
}

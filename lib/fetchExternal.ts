export async function fetchNewBuses() {
  try {
    const res = await fetch(process.env.BUS_URL as string);
    console.log('Fetching new buses from:', process.env.BUS_URL);
    console.log('Response status:', res.status);

    if (!res.ok) throw new Error('Failed to fetch buses');
    return await res.json();
  } catch (error) {
    console.error("Bus API unavailable:", error);
    return []; // fallback empty
  }
}

export async function fetchNewDrivers() {
  try {
    const res = await fetch(process.env.DRIVER_URL as string);
    if (!res.ok) throw new Error('Failed to fetch drivers');
    return await res.json();
  } catch (error) {
    console.error("Driver API unavailable:", error);
    return [];
  }
}

export async function fetchNewConductors() {
  try {
    const res = await fetch(process.env.CONDUCTOR_URL as string);
    if (!res.ok) throw new Error('Failed to fetch conductors');
    return await res.json();
  } catch (error) {
    console.error("Conductor API unavailable:", error);
    return [];
  }
}


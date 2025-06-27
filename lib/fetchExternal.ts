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


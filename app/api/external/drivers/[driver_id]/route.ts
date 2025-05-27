import { fetchDriverById } from '@/lib/fetchDrivers';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  let driverId = parts[parts.length - 1]; // last part of path

  driverId = decodeURIComponent(driverId).trim();

  if (!driverId) {
    return new Response(JSON.stringify({ error: 'Missing driver ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const driver = await fetchDriverById(driverId);

    if (!driver) {
      return new Response(JSON.stringify({ error: 'Driver not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ data: driver }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    let message = 'Unknown error';
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }

    console.error(error);
    return new Response(JSON.stringify({ error: 'Failed to fetch driver', details: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

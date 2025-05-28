import { fetchDriverById } from '@/lib/fetchDrivers';
import { authenticateRequest } from '@/lib/auth';

export async function GET(request: Request) {
const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return new Response(JSON.stringify({ error }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const url = new URL(request.url);
    const driverId = decodeURIComponent(url.pathname.split('/').at(-1) || '').trim();

    if (!driverId) {
      return new Response(JSON.stringify({ error: 'Missing driver ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('GET_DRIVER_BY_ID_ERROR', message);

    return new Response(JSON.stringify({
      error: 'Failed to fetch driver',
      details: message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

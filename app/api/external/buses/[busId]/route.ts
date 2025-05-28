import { fetchBusById } from '@/lib/fetchBuses';
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
    const parts = url.pathname.split('/');
    const busId = decodeURIComponent(parts.at(-1) || '').trim();

    if (!busId) {
      return new Response(JSON.stringify({ error: 'Missing bus ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const bus = await fetchBusById(busId);

    if (!bus) {
      return new Response(JSON.stringify({ error: 'Bus not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ data: bus }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    console.error('GET_BUS_BY_ID_ERROR', message);

    return new Response(JSON.stringify({
      error: 'Failed to fetch bus',
      details: message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

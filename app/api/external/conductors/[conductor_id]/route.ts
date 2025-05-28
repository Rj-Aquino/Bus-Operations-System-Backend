import { fetchConductorById } from '@/lib/fetchConductors';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const conductorId = decodeURIComponent(url.pathname.split('/').at(-1) || '').trim();

    if (!conductorId) {
      return new Response(JSON.stringify({ error: 'Missing conductor ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const conductor = await fetchConductorById(conductorId);

    if (!conductor) {
      return new Response(JSON.stringify({ error: 'Conductor not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ data: conductor }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    console.error('GET_CONDUCTOR_BY_ID_ERROR', message);

    return new Response(JSON.stringify({
      error: 'Failed to fetch conductor',
      details: message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

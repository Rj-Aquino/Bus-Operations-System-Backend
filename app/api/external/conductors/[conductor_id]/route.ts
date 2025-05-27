import { fetchConductorById } from '@/lib/fetchConductors';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  let conductorId = parts[parts.length - 1]; // last part of path

  conductorId = decodeURIComponent(conductorId).trim();

  if (!conductorId) {
    return new Response(JSON.stringify({ error: 'Missing conductor ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
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
  } catch (error) {
    let message = 'Unknown error';
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }

    console.error(error);
    return new Response(JSON.stringify({ error: 'Failed to fetch conductor', details: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

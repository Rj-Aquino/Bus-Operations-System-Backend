import { fetchBusById } from '@/lib/fetchBuses';

export async function GET(request: Request) {

  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  let busId = parts[parts.length - 1]; // last part of path

  busId = decodeURIComponent(busId).trim();

  if (!busId) {
    return new Response(JSON.stringify({ error: 'Missing bus ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
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
  } catch (error) {
    // Narrow the error type safely
    let message = 'Unknown error';
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }

    console.error(error);
    return new Response(JSON.stringify({ error: 'Failed to fetch bus', details: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

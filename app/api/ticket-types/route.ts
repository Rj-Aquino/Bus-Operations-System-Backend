import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { getCache, setCache, CACHE_KEYS } from '@/lib/cache';

const TICKET_TYPES_CACHE_KEY = CACHE_KEYS.TICKET_TYPES ?? '';

const getTicketTypes = async (request: NextRequest) => {
  const { error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  // Try cache first
  const cached = await getCache(TICKET_TYPES_CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached, { status: 200 });
  }

  try {
    const ticketTypes = await prisma.ticketType.findMany({
      select: {
        TicketTypeID: true,
        Value: true,
      },
    });
    await setCache(TICKET_TYPES_CACHE_KEY, ticketTypes);
    return NextResponse.json(ticketTypes, { status: 200 });
  } catch (error) {
    console.error('Error fetching ticket types:', error);
    return NextResponse.json({ error: 'Failed to fetch ticket types' }, { status: 500 });
  }
};

export const GET = withCors(getTicketTypes);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
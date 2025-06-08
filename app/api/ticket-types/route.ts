import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';

const getTicketTypes = async (request: NextRequest) => {
  const { error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const ticketTypes = await prisma.ticketType.findMany({
      select: {
        TicketTypeID: true,
        Value: true,
      },
    });
    return NextResponse.json(ticketTypes, { status: 200 });
  } catch (error) {
    console.error('Error fetching ticket types:', error);
    return NextResponse.json({ error: 'Failed to fetch ticket types' }, { status: 500 });
  }
};

export const GET = withCors(getTicketTypes);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
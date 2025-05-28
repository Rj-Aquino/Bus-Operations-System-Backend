import { NextResponse } from 'next/server';
import prisma from '@/client';
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
    const routes = await prisma.route.findMany({
      where: {
        IsDeleted: false,
      },
      select: {
        RouteID: true,
        RouteName: true,
        StartStop: {
          select: {
            StopID: true,
            StopName: true,
          },
        },
        EndStop: {
          select: {
            StopID: true,
            StopName: true,
          },
        },
        RouteStops: {
          select: {
            StopOrder: true,
            Stop: {
              select: {
                StopName: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(routes);
  } catch (error) {
    console.error('Failed to fetch full route details:', error);
    return NextResponse.json({ error: 'Failed to fetch full route details' }, { status: 500 });
  }
}
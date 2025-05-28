import { NextResponse } from 'next/server';
import prisma from '@/client';

export async function GET() {
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
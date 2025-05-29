import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';

const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
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
                StopID: true,
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
};

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));

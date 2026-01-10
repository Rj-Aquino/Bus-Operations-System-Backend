import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';

/**
 * GET /api/bus-operations/trip-history
 * Retrieves completed bus trip history with details
 */
const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const skip = (page - 1) * limit;

    // Fetch completed bus trips (those with CompletedAt set)
    const [trips, totalCount] = await Promise.all([
      prisma.busTrip.findMany({
        where: {
          CompletedAt: { not: null }
        },
        orderBy: { CompletedAt: 'desc' },
        skip,
        take: limit,
        select: {
          BusTripID: true,
          DispatchedAt: true,
          CompletedAt: true,
          Sales: true,
          TripExpense: true,
          PettyCash: true,
          Payment_Method: true,
          Remarks: true,
          regularBusAssignment: {
            select: {
              DriverID: true,
              ConductorID: true,
              BusAssignment: {
                select: {
                  BusID: true,
                  Route: {
                    select: {
                      RouteID: true,
                      RouteName: true
                    }
                  }
                }
              }
            }
          },
          DamageReports: {
            select: {
              DamageReportID: true,
              Status: true
            }
          }
        }
      }),
      prisma.busTrip.count({
        where: {
          CompletedAt: { not: null }
        }
      })
    ]);

    return NextResponse.json({
      trips,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (err) {
    console.error('GET_TRIP_HISTORY_ERROR', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch trip history' },
      { status: 500 }
    );
  }
};

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));

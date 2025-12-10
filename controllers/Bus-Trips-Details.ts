import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { BusTripsDetailsService } from '@/services/Bus-Trips-Details';

export class BusTripsDetailsController {
  private service = new BusTripsDetailsService();

  async handleGet(request: NextRequest) {
    try {
      const url = new URL(request.url);
      const filterBy = url.searchParams.get('RequestType')?.toLowerCase() ?? null;

      // Fetch from service
      const result = await this.service.getAssignmentSummary(filterBy);

      return NextResponse.json(result, { status: 200 });
    } catch (err) {
      console.error('GET_BUS_TRIPS_DETAILS_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to fetch bus trips details';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  async handlePatch(request: NextRequest) {
    const { user, error, status } = await authenticateRequest(request);
    // if (error) return NextResponse.json({ error }, { status });

    try {
      const body = await request.json();

      if (!Array.isArray(body)) {
        return NextResponse.json({ error: 'Expected an array of records' }, { status: 400 });
      }

      const updates = body.filter(item => typeof item?.bus_trip_id === 'string');

      if (updates.length === 0) {
        return NextResponse.json({ error: 'No valid bus_trip_id values found' }, { status: 400 });
      }

      const actor = user?.employeeId || null;
      const result = await this.service.updateBusTrips(updates, actor);

      return NextResponse.json(result, { status: 200 });
    } catch (err) {
      console.error('PATCH_BUS_TRIPS_DETAILS_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Internal server error';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }
}
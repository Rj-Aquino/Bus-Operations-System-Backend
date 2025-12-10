import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { ExternalService } from '@/services/external';

export class ExternalController {
  private service = new ExternalService();

  // ========== DRIVERS ==========

  async handleGetUnassignedDrivers(request: NextRequest): Promise<NextResponse> {
    try {

      const drivers = await this.service.getUnassignedDrivers();

      return NextResponse.json(
        { message: drivers.length > 0 ? 'Drivers fetched successfully' : 'No drivers found', data: drivers },
        { status: 200 }
      );
    } catch (err) {
      console.error('GET_UNASSIGNED_DRIVERS_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to fetch drivers';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  async handleGetAllDrivers(request: NextRequest): Promise<NextResponse> {
    try {
    
      const drivers = await this.service.getAllDrivers();

      return NextResponse.json(
        { message: drivers.length > 0 ? 'Drivers fetched successfully' : 'No drivers found', data: drivers },
        { status: 200 }
      );
    } catch (err) {
      console.error('GET_ALL_DRIVERS_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to fetch drivers';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  async handleGetAvailableDriversForRent(request: NextRequest): Promise<NextResponse> {
    const { user, error, status } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    try {
      const url = new URL(request.url);
      const startDate = url.searchParams.get('startDate');
      const duration = url.searchParams.get('duration');

      const drivers = await this.service.getAvailableDriversForRent(startDate ?? undefined, duration ?? undefined);

      return NextResponse.json(
        { message: drivers.length > 0 ? undefined : 'No drivers found', data: drivers },
        { status: 200 }
      );
    } catch (err) {
      console.error('GET_AVAILABLE_DRIVERS_RENT_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to fetch drivers';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  // ========== CONDUCTORS ==========

  async handleGetUnassignedConductors(request: NextRequest): Promise<NextResponse> {
    try {

      const conductors = await this.service.getUnassignedConductors();

      return NextResponse.json(
        { message: conductors.length ? undefined : 'No conductors found', data: conductors },
        { status: 200 }
      );
    } catch (err) {
      console.error('GET_UNASSIGNED_CONDUCTORS_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to fetch conductors';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  async handleGetAllConductors(request: NextRequest): Promise<NextResponse> {
    try {

      const conductors = await this.service.getAllConductors();

      return NextResponse.json(
        { message: conductors.length ? undefined : 'No conductors found', data: conductors },
        { status: 200 }
      );
    } catch (err) {
      console.error('GET_ALL_CONDUCTORS_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to fetch conductors';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // ========== BUSES ==========

  async handleGetUnassignedBuses(request: NextRequest): Promise<NextResponse> {
    try {

      const buses = await this.service.getUnassignedBuses();

      return NextResponse.json(
        { message: buses.length ? undefined : 'No buses found', data: buses },
        { status: 200 }
      );
    } catch (err) {
      console.error('GET_UNASSIGNED_BUSES_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to fetch buses';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  async handleGetAllBuses(request: NextRequest): Promise<NextResponse> {
    try {

      const buses = await this.service.getAllBuses();

      return NextResponse.json(
        { message: buses.length ? undefined : 'No buses found', data: buses },
        { status: 200 }
      );
    } catch (err) {
      console.error('GET_ALL_BUSES_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to fetch buses';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  async handleGetAvailableBusesForRent(request: NextRequest): Promise<NextResponse> {
    const { user, error, status } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    try {
      const url = new URL(request.url);
      const busType = url.searchParams.get('busType');
      const startDate = url.searchParams.get('startDate');
      const duration = url.searchParams.get('duration');

      const buses = await this.service.getAvailableBusesForRent(
        busType ?? undefined,
        startDate ?? undefined,
        duration ?? undefined
      );

      return NextResponse.json(
        { message: buses.length ? undefined : 'No buses found', data: buses },
        { status: 200 }
      );
    } catch (err) {
      console.error('GET_AVAILABLE_BUSES_RENT_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to fetch buses';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }
}
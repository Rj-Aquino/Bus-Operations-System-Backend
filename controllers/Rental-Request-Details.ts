import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { RentalRequestDetailsService } from '@/services/Rental-Request-Details';

const service = new RentalRequestDetailsService();

export class RentalRequestDetailsController {
  async handleGet(request: NextRequest) {
    const { user, error, status } = await authenticateRequest(request);
    // if (error) {
    //   return NextResponse.json({ error }, { status });
    // }

    try {
      const { searchParams } = new URL(request.url);
      const filterStatus = searchParams.get('status');

      console.log('Filter Status:', filterStatus);

      const results = await service.getRentalRequestDetails(filterStatus);

      return NextResponse.json(results, { status: 200 });
    } catch (err) {
      console.error('GET_RENTAL_REQUEST_DETAILS_ERROR', err);
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to fetch rental request details';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }
}
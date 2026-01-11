import { NextRequest, NextResponse } from 'next/server';
import { RentalCalculateService } from '@/services/rental-calculate';

export class RentalCalculateController {
  private service = new RentalCalculateService();

  async handlePost(request: NextRequest) {
    try {
      const body = await request.json();

      const { busType, duration, distance, passengers } = body ?? {};

      // Validate required fields
      if (busType === undefined || duration === undefined || distance === undefined || passengers === undefined) {
        return NextResponse.json(
          { error: 'Missing required fields: busType, duration, distance, passengers' },
          { status: 400 }
        );
      }

      // Calculate rental price
      const result = await this.service.calculateRentalPrice({
        busType,
        duration,
        distance,
        passengers,
      });

      return NextResponse.json(result, { status: 200 });
    } catch (err) {
      console.error('CALCULATE_RENTAL_PRICE_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to calculate rental price';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }
}
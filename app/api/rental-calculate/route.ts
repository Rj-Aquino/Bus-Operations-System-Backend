import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/withcors';

interface CalculateRequest {
  busType: 'Aircon' | 'Non-Aircon';
  duration: number; // days
  distance: number; // km
  passengers: number;
}

interface PriceBreakdown {
  baseRate: number;
  durationFee: number;
  distanceFee: number;
  extraFees: number;
  total: number;
}

const postHandler = async (request: NextRequest) => {
  try {
    const body = await request.json();

    const {
      busType,
      duration,
      distance,
      passengers,
    }: CalculateRequest = body;

    // Validate required fields
    if (!busType || !duration || !distance || !passengers) {
      return NextResponse.json({ 
        error: 'Missing required fields: busType, duration, distance, passengers' 
      }, { status: 400 });
    }

    // Validate bus type
    if (!['Aircon', 'Non-Aircon'].includes(busType)) {
      return NextResponse.json({ 
        error: 'Invalid busType. Must be "Aircon" or "Non-Aircon"' 
      }, { status: 400 });
    }

    // Validate numeric values
    const d = Math.max(0, parseInt(duration.toString(), 10) || 0);
    const dist = Math.max(0, parseInt(distance.toString(), 10) || 0);
    const pax = Math.max(0, parseInt(passengers.toString(), 10) || 0);

    if (d <= 0 || dist <= 0 || pax <= 0) {
      return NextResponse.json({ 
        error: 'Duration, distance, and passengers must be greater than 0' 
      }, { status: 400 });
    }

    // Calculate price breakdown using the same logic as frontend
    const baseRate = busType === "Aircon" ? 5000 : 3000;
    const durationFee = d * 1000; // ₱1,000 per day
    const distanceFee = dist * 10; // ₱10 per km
    const extraFees = pax > 40 ? 500 : 0; // extra fee if >40 passengers
    const total = baseRate + durationFee + distanceFee + extraFees;

    const priceBreakdown: PriceBreakdown = {
      baseRate,
      durationFee,
      distanceFee,
      extraFees,
      total,
    };

    return NextResponse.json({
      success: true,
      priceBreakdown,
      calculation: {
        busType,
        duration: d,
        distance: dist,
        passengers: pax,
      },
    }, { status: 200 });

  } catch (err) {
    console.error('Error calculating rental price:', err);
    return NextResponse.json({ 
      error: 'Failed to calculate rental price' 
    }, { status: 500 });
  }
};

export const POST = withCors(postHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
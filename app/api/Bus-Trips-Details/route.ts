import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/withcors';
import { BusTripsDetailsController } from '@/controllers/Bus-Trips-Details';

const controller = new BusTripsDetailsController();

const getHandler = (req: NextRequest) => controller.handleGet(req);
const patchHandler = (req: NextRequest) => controller.handlePatch(req);

export const GET = withCors(getHandler);
export const PATCH = withCors(patchHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/withcors';
import { BusOperationsController } from '@/controllers/bus-operations';

const controller = new BusOperationsController();

const putHandler = (req: NextRequest) => controller.handlePut(req);

export const PUT = withCors(putHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
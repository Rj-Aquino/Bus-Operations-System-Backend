import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/withcors';
import { BusAssignmentController } from '@/controllers/bus-assignment';

const controller = new BusAssignmentController();

const putHandler = (req: NextRequest) => controller.handlePut(req);
const patchHandler = (req: NextRequest) => controller.handlePatch(req);

export const PUT = withCors(putHandler);
export const PATCH = withCors(patchHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
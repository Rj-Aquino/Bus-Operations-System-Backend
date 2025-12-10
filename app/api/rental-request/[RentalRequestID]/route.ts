import { withCors } from '@/lib/withcors';
import { RentalRequestController } from '@/controllers/rental-request';
import { NextRequest, NextResponse} from 'next/server';

const controller = new RentalRequestController();
const putHandler = (req: NextRequest) => controller.handlePut(req);
const patchHandler = (req: NextRequest) => controller.handlePatch(req);

export const PUT = withCors(putHandler);
export const PATCH = withCors(patchHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
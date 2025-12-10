import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/withcors';
import { RentalCalculateController } from '@/controllers/rental-calculate';

const controller = new RentalCalculateController();

const postHandler = (req: NextRequest) => controller.handlePost(req);

export const POST = withCors(postHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
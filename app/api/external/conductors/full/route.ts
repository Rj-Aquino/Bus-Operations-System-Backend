import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/withcors';
import { ExternalController } from '@/controllers/external';

const controller = new ExternalController();

const getHandler = (req: NextRequest) => controller.handleGetAllConductors(req);

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
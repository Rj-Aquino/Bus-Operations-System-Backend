import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/withcors';
import { DamageReportController } from '@/controllers/damage-report';

const controller = new DamageReportController();

const getHandler = (req: NextRequest) => controller.handleGet(req);

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
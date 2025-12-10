import { withCors } from '@/lib/withcors';
import { StopsController } from '@/controllers/stops';
import { NextRequest, NextResponse} from 'next/server';

const controller = new StopsController();
const getHandler = (req: NextRequest) => controller.handleGet(req);
const postHandler = (req: NextRequest) => controller.handlePost(req);

export const GET = withCors(getHandler);
export const POST = withCors(postHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
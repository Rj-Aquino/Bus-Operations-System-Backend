import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/withcors';
import { clearAllCache } from '@/lib/cache';
import { authenticateRequest } from '@/lib/auth';

const clearCacheHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    await clearAllCache();
    return NextResponse.json({ message: 'All cache cleared.' }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to clear cache.' }, { status: 500 });
  }
};

export const POST = withCors(clearCacheHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
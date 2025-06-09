import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { withCors } from '@/lib/withcors';

const verifyTokenHandler = async (request: NextRequest) => {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ valid: false, message: 'No token provided' }, { status: 401 });
  }
  const token = authHeader.split(' ')[1];
  try {
    verifyToken(token);
    return NextResponse.json({ valid: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ valid: false, message: 'Invalid or expired token' }, { status: 401 });
  }
};

export const GET = withCors(verifyTokenHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
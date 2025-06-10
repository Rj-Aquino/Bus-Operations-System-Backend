import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { withCors } from '@/lib/withcors';

function extractTokenFromCookie(cookie: string | undefined): string | null {
  if (!cookie) return null;
  const match = cookie.match(/token=([^;]+)/);
  return match ? match[1] : null;
}

const verifyTokenHandler = async (request: NextRequest) => {
  let token: string | null = null;
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else {
    // Fallback to cookie
    const cookie = request.headers.get('cookie');
    token = extractTokenFromCookie(cookie || '');
  }

  if (!token) {
    return NextResponse.json({ valid: false, message: 'No token provided' }, { status: 401 });
  }

  try {
    const decoded = verifyToken(token);
    return NextResponse.json({ valid: true, user: decoded }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ valid: false, message: 'Invalid or expired token' }, { status: 401 });
  }
};

export const GET = withCors(verifyTokenHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
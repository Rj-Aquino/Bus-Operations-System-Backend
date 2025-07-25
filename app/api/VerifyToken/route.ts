import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { withCors } from '@/lib/withcors';

function extractTokenFromCookie(cookie: string | undefined): string | null {
  if (!cookie) return null;

  const jwtMatch = cookie.match(/(?:^|;\s*)jwt=([^;]+)/);
  const tokenMatch = cookie.match(/(?:^|;\s*)token=([^;]+)/);

  return jwtMatch?.[1] || tokenMatch?.[1] || null;
}

const verifyTokenHandler = async (request: NextRequest) => {
  let token: string | null = null;
  const authHeader = request.headers.get('authorization');

  if (authHeader && authHeader.startsWith('Bearer')) {
    token = authHeader.split(' ')[1];

  } else {
    // Fallback to cookie
    const cookie = request.headers.get('cookie');
    console.log('Cookie header:', cookie);
    token = extractTokenFromCookie(cookie || '');
    console.log('Token extracted from cookie:', token);
  }

  if (!token) {
    console.log('No token provided');
    return NextResponse.json({ valid: false, message: 'No token provided' }, { status: 401 });
  }

  try {
    const decoded = verifyToken(token) as any;
    console.log('Token successfully verified. Decoded payload:', decoded);
    // Role is not included in the response
    return NextResponse.json(
      { valid: true, user: decoded },
      { status: 200 }
    );
  } catch (error) {
    console.log('Token verification failed:', error);
    return NextResponse.json({ valid: false, message: 'Invalid or expired token' }, { status: 401 });
  }
};

export const GET = withCors(verifyTokenHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
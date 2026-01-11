import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/withcors';
import * as jwt from 'jsonwebtoken';

// Public key for RS256 verification
const PUBLIC_KEY = process.env.AUTH_PUBLIC_KEY || '';

function extractTokenFromCookie(cookie: string | undefined): string | null {
  if (!cookie) return null;

  const jwtMatch = cookie.match(/(?:^|;\s*)jwt=([^;]+)/);
  const tokenMatch = cookie.match(/(?:^|;\s*)token=([^;]+)/);

  return jwtMatch?.[1] || tokenMatch?.[1] || null;
}

function verifyToken(token: string) {
  try {
    // Verify using RS256 algorithm with public key
    const decoded = jwt.verify(token, PUBLIC_KEY, {
      algorithms: ['RS256'],
      issuer: 'agila-auth',      // Must match the token's "iss" claim
      audience: 'agila-apis',    // Must match the token's "aud" claim
    });

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    } else {
      throw new Error('Token verification failed');
    }
  }
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
    return NextResponse.json(
      { valid: false, message: 'No token provided' }, 
      { status: 401 }
    );
  }

  try {
    const decoded = verifyToken(token) as any;
    console.log('Token successfully verified. Decoded payload:', decoded);
    
    return NextResponse.json(
      { 
        valid: true, 
        user: {
          sub: decoded.sub,
          employeeId: decoded.employeeId,
          employeeNumber: decoded.employeeNumber,
          role: decoded.role,
          departmentName: decoded.departmentName,
          departmentIds: decoded.departmentIds,
          positionName: decoded.positionName,
          exp: decoded.exp,
          iat: decoded.iat,
        }
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid or expired token';
    console.log('Token verification failed:', errorMessage);
    
    return NextResponse.json(
      { valid: false, message: errorMessage }, 
      { status: 401 }
    );
  }
};

export const GET = withCors(verifyTokenHandler);
export const POST = withCors(verifyTokenHandler); // Support POST as well
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
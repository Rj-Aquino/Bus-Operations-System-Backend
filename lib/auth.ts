// backend: lib/auth.ts
import { NextResponse } from 'next/server';
import { getAllowedRolesForRoute, Role } from '@/lib/roles';

type JWTUser = {
  role?: Role;
  employeeId?: string;
  sub?: string;
  employeeNumber?: string;
  departmentName?: string[];
  departmentIds?: string[];
  positionName?: string[];
  exp?: number;
  [key: string]: any;
};

function extractTokenFromCookie(cookie: string | undefined, tokenName: string): string | null {
  if (!cookie) return null;

  const regex = new RegExp(`(?:^|;\\s*)${tokenName}=([^;]+)`);
  const match = cookie.match(regex);

  return match?.[1] || null;
}

function decodeJWT(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8')
    );
    
    return payload;
  } catch (error) {
    throw new Error('Failed to decode token');
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const decoded = decodeJWT(token);
    
    if (!decoded.exp) {
      return true;
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp <= currentTime;
  } catch {
    return true;
  }
}

// backend: lib/auth.ts
export type AuthResult = {
  user?: JWTUser;
  token?: string;
  error?: string;
  status?: number;
};

export const authenticateRequest = async (request: Request): Promise<AuthResult> => {
  const cookie = request.headers.get('cookie');
  
  const accessToken = extractTokenFromCookie(cookie || '', 'accessToken');

  if (!accessToken) {
    return { 
      error: 'Missing access token. Please login again.', 
      status: 401 
    };
  }

  if (isTokenExpired(accessToken)) {
    return { 
      error: 'Token expired. Please refresh your session.', 
      status: 401 
    };
  }

  try {
    const decoded = decodeJWT(accessToken) as JWTUser;

    const user: JWTUser = {
      ...decoded,
      employeeId: decoded.employeeId || decoded.sub || undefined,
    };

    return { 
      user, 
      token: accessToken,
    };
  } catch (err) {
    console.log('Token decode failed:', err);
    return { 
      error: 'Invalid token. Please login again.', 
      status: 401 
    };
  }
};
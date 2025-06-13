import { verifyToken } from './jwt';
import { getAllowedRolesForRoute, Role } from '@/lib/roles';

function extractTokenFromCookie(cookie: string | undefined): string | null {
  if (!cookie) return null;
  const match = cookie.match(/token=([^;]+)/);
  return match ? match[1] : null;
}

export const authenticateRequest = async (request: Request) => {
  let token: string | null = null;

  // Try Authorization header first
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else {
    // Fallback to cookie
    const cookie = request.headers.get('cookie');
    token = extractTokenFromCookie(cookie || '');
  }

  if (!token) {
    return { error: 'Missing or malformed token', status: 401 };
  }

  try {
    const user = verifyToken(token) as { role: Role };
    // const url = new URL(request.url);
    // const pathname = url.pathname;
    // const allowedRoles = getAllowedRolesForRoute(pathname);

    // if (!allowedRoles) {
    //   return { error: 'No role mapping defined for this route', status: 403 };
    // }

    // if (!allowedRoles.includes(user.role)) {
    //   return { error: 'Forbidden: role not allowed', status: 403 };
    // }

    return { user };
  } catch (err) {
    console.log('Token verification failed:', err);
    return { error: 'Invalid or expired token', status: 401 };
  }
};
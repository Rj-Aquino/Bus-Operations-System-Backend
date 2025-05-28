import { verifyToken } from './jwt';
import { getAllowedRolesForRoute, Role } from '@/lib/roles';

export const authenticateRequest = async (request: Request) => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing or malformed token', status: 401 };
  }

  const token = authHeader.split(' ')[1];

  try {
    const user = verifyToken(token) as { role: Role };

    // Extract pathname from the request URL
    const url = new URL(request.url);
    const pathname = url.pathname;

    const allowedRoles = getAllowedRolesForRoute(pathname);

    if (!allowedRoles) {
      return { error: 'No role mapping defined for this route', status: 403 };
    }

    if (!allowedRoles.includes(user.role)) {
      return { error: 'Forbidden: role not allowed', status: 403 };
    }

    return { user };
  } catch (err) {
    return { error: 'Invalid or expired token', status: 401 };
  }
};

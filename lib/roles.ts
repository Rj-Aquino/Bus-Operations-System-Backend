export const ROLES = {
  ADMIN: 'admin',
  DISPATCHER: 'dispatcher',
  OPERATIONAL_MANAGER: 'operational_manager',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Route-to-role mapping
export const ROUTE_ACCESS: Record<string, Role[]> = {
  '/api/bus-assignment': [ROLES.ADMIN, ROLES.OPERATIONAL_MANAGER, ROLES.DISPATCHER], // GET, POST
  '/api/bus-assignment/:id': [ROLES.ADMIN, ROLES.OPERATIONAL_MANAGER, ROLES.DISPATCHER], // PUT, PATCH

  '/api/bus-operations': [ROLES.ADMIN, ROLES.OPERATIONAL_MANAGER, ROLES.DISPATCHER], // GET
  '/api/bus-operations/:id': [ROLES.ADMIN, ROLES.OPERATIONAL_MANAGER, ROLES.DISPATCHER], // PUT

  '/api/external/buses': [ROLES.ADMIN, ROLES.OPERATIONAL_MANAGER, ROLES.DISPATCHER], // GET
  '/api/external/buses/:id': [ROLES.ADMIN, ROLES.OPERATIONAL_MANAGER, ROLES.DISPATCHER], // GET

  '/api/external/conductors': [ROLES.ADMIN, ROLES.OPERATIONAL_MANAGER, ROLES.DISPATCHER], // GET
  '/api/external/conductors/:id': [ROLES.ADMIN, ROLES.OPERATIONAL_MANAGER, ROLES.DISPATCHER], // GET

  '/api/external/drivers': [ROLES.ADMIN, ROLES.OPERATIONAL_MANAGER, ROLES.DISPATCHER], // GET
  '/api/external/drivers/:id': [ROLES.ADMIN, ROLES.OPERATIONAL_MANAGER, ROLES.DISPATCHER], // GET

  '/api/quota-assignment': [ROLES.ADMIN, ROLES.OPERATIONAL_MANAGER, ROLES.DISPATCHER], // GET, POST
  '/api/quota-assignment/:id': [ROLES.ADMIN, ROLES.OPERATIONAL_MANAGER, ROLES.DISPATCHER], // PUT

  '/api/route-management': [ROLES.ADMIN, ROLES.OPERATIONAL_MANAGER], // GET, POST
  '/api/route-management/full': [ROLES.ADMIN, ROLES.OPERATIONAL_MANAGER], // GET
  '/api/route-management/:id': [ROLES.ADMIN, ROLES.OPERATIONAL_MANAGER], // PUT, PATCH

  '/api/stops': [ROLES.ADMIN, ROLES.OPERATIONAL_MANAGER], // GET, POST
  '/api/stops/:id': [ROLES.ADMIN, ROLES.OPERATIONAL_MANAGER], // PUT, PATCH
};

// Function to get allowed roles for a given path
export const getAllowedRolesForRoute = (pathname: string): Role[] | undefined => {
  // Direct match
  if (ROUTE_ACCESS[pathname]) return ROUTE_ACCESS[pathname];

  // Pattern match for dynamic routes (e.g., :id)
  const dynamicMatch = Object.entries(ROUTE_ACCESS).find(([pattern]) => {
    if (!pattern.includes(':')) return false;

    const regex = new RegExp(
      '^' + pattern.replace(/:[^/]+/g, '[^/]+') + '$'
    );

    return regex.test(pathname);
  });

  return dynamicMatch?.[1];
};
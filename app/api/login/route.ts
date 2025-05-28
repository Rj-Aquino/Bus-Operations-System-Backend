import { signToken } from '@/lib/jwt';
import { ROLES } from '@/lib/roles';

export async function POST(request: Request) {
  const body = await request.json();
  const { role } = body;

  if (!role) {
    return new Response(JSON.stringify({ message: 'Role is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

    if (!Object.values(ROLES).includes(role)) {
    return new Response(JSON.stringify({ message: 'Invalid role' }), { status: 400 });
    }

  const token = signToken(
    {
      userId: `mock-${role}`,
      name: `${role.toUpperCase()} User`,
      role,
      iss: 'mock-auth.local',
    },
    '1h'
  );

  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
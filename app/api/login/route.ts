import { NextResponse } from 'next/server';
import { withCors } from '@/lib/withcors';
import { signToken } from '@/lib/jwt';
import { ROLES } from '@/lib/roles';

const postHandler = async (request: Request) => {
  const body = await request.json();
  const { role } = body;

  if (!role) {
    return NextResponse.json({ message: 'Role is required' }, { status: 400 });
  }

  if (!Object.values(ROLES).includes(role)) {
    return NextResponse.json({ message: 'Invalid role' }, { status: 400 });
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

  return NextResponse.json({ token }, { status: 200 });
};

export const POST = withCors(postHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));


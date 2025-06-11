import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/withcors';
import { signToken } from '@/lib/jwt';
import { ROLES } from '@/lib/roles';

const postHandler = async (request: NextRequest) => {
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

  const response = new NextResponse(JSON.stringify({ token }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  response.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    maxAge: 60 * 60,
  });
  
  return response;
};

export const POST = withCors(postHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
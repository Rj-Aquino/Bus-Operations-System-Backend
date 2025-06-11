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

  // Detect if the request is from localhost or LAN for local dev
  const origin = request.headers.get('origin');
  const isLocal =
    origin?.startsWith('http://localhost') ||
    origin?.startsWith('http://127.0.0.1') ||
    origin?.startsWith('http://192.168.') ||
    origin?.startsWith('http://10.') ||
    origin?.startsWith('http://172.');

  const response = new NextResponse(JSON.stringify({ token }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  response.cookies.set('token', token, {
    httpOnly: true,
    secure: !isLocal, // false for local, true for deployed (HTTPS)
    sameSite: isLocal ? 'lax' : 'none', // 'lax' for local, 'none' for deployed
    path: '/',
    maxAge: 60 * 60,
  });

  return response;
};

export const POST = withCors(postHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
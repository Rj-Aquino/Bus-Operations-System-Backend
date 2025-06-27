import { NextRequest, NextResponse } from 'next/server';

const allowedOrigins = [
  'https://bus-operations-system.vercel.app',
  'http://192.168.254.106:3000',
  'https://bus-operations-system-lemon.vercel.app',
  'http://192.168.1.4:3000',
  'https://boms.agilabuscorp.me',
  'http://192.168.0.161:3000',
  'https://boms.agilabuscorp.me',
  'http://192.168.0.168:3000',
  'http://192.168.0.132:3000',
  // 'http://localhost:3000',
  'http://192.168.1.14:3000'
];

export function withCors(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    const origin = request.headers.get('origin');
    const headers = new Headers({
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json',
    });

    if (
      origin &&
      (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app'))
    ) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Credentials', 'true');
    }

    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers });
    }

    const response = await handler(request);
    headers.forEach((value, key) => {
      response.headers.set(key, value);
    });

    return response;
  };
}

import { NextRequest, NextResponse } from 'next/server';

const allowedOrigins = [
  'https://bus-operations-system.vercel.app',
  'http://192.168.254.106:3000',
  'https://bus-operations-system-lemon.vercel.app',
  'http://192.168.1.4:3000',
  'https://boms.agilabuscorp.me',
  'http://192.168.0.161:3000',
  'http://192.168.0.168:3000',
  'http://192.168.0.132:3000',
  'http://localhost:3000',
  'http://192.168.1.14:3000',
  'http://192.168.56.1:3000',
  'http://192.168.254.104:3000',
];

export function withCors(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    const origin = request.headers.get('origin');
    
    // Check if origin is allowed
    const isAllowed = origin && (
      allowedOrigins.includes(origin) || 
      origin.endsWith('.vercel.app')
    );

    // Handle OPTIONS preflight request
    if (request.method === 'OPTIONS') {
      const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };

      if (isAllowed) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Credentials'] = 'true';
      }

      return new NextResponse(null, { status: 204, headers });
    }

    // Call the actual handler
    const response = await handler(request);

    // Add CORS headers to response
    if (isAllowed && origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;
  };
}

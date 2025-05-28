// lib/withCors.ts

import { NextRequest, NextResponse } from 'next/server';

const allowedOrigins = [
  'https://bus-operations-system.vercel.app',
  'http://192.168.254.106:3000',
];

function createCorsHeaders(origin: string | null): HeadersInit {
  const headers: HeadersInit = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

export function withCors(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const origin = req.headers.get('origin');
    const corsHeaders = createCorsHeaders(origin);

    // Handle OPTIONS (preflight)
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Handle normal request
    const response = await handler(req);

    // Merge CORS headers into the response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value as string);
    });

    return response;
  };
}

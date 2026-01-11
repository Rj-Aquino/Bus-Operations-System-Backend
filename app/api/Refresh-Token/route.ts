// app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/withcors';

const REFRESH_API_URL = process.env.REFRESH_API_URL || '';

function extractTokenFromCookie(cookie: string | undefined, tokenName: string): string | null {
  if (!cookie) return null;
  const regex = new RegExp(`(?:^|;\\s*)${tokenName}=([^;]+)`);
  const match = cookie.match(regex);
  return match?.[1] || null;
}

async function refreshAccessToken(refreshToken: string) {
  try {
    const response = await fetch(REFRESH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to refresh token');
    }

    const data = await response.json();
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    throw new Error('Token refresh failed');
  }
}

const refreshHandler = async (request: NextRequest) => {
  const cookie = request.headers.get('cookie');
  const refreshToken = extractTokenFromCookie(cookie || '', 'refreshToken');

  if (!refreshToken) {
    return NextResponse.json(
      { success: false, message: 'No refresh token provided' }, 
      { status: 401 }
    );
  }

  try {
    const tokens = await refreshAccessToken(refreshToken);
    
    // Create response - NO tokens in body for security!
    const response = NextResponse.json({ 
      success: true,
      message: 'Token refreshed successfully'
    });
    
    // Set new tokens as secure httpOnly cookies
    response.cookies.set('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      domain: '.agilabuscorp.me',
      path: '/',
      maxAge: 60 * 15, // 15 minutes
    });
    
    response.cookies.set('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      domain: '.agilabuscorp.me',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Token refresh failed';
    console.error('Token refresh failed:', errorMessage);
    
    return NextResponse.json(
      { success: false, message: errorMessage }, 
      { status: 401 }
    );
  }
};

// Wrap the handler with CORS
export const POST = withCors(refreshHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
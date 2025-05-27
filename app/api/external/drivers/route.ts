import { fetchDrivers } from '@/lib/fetchDrivers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const drivers = await fetchDrivers();
    return NextResponse.json({ data: drivers });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch drivers' }, { status: 500 });
  }
}

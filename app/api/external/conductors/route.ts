import { fetchConductors } from '@/lib/fetchConductors';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const conductors = await fetchConductors();
    return NextResponse.json({ data: conductors });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch conductors' }, { status: 500 });
  }
}
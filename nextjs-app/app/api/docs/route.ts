import { NextResponse } from 'next/server';
import { requirements } from '@/lib/db/data-requirements';

export async function GET() {
  try {
    return NextResponse.json(requirements);
  } catch (error) {
    console.error('Error loading requirements:', error);
    return NextResponse.json(
      { error: 'Failed to load requirements' },
      { status: 500 }
    );
  }
}

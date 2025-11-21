import { NextResponse } from 'next/server';
import { docs } from '@/lib/docs';

export async function GET() {
  try {
    return NextResponse.json(docs);
  } catch (error) {
    console.error('Error loading documentation:', error);
    return NextResponse.json(
      { error: 'Failed to load documentation' },
      { status: 500 }
    );
  }
}

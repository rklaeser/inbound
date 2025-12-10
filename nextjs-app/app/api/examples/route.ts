import { NextRequest, NextResponse } from 'next/server';
import { getExamples, createExample } from '@/lib/examples-service';

/**
 * GET /api/examples
 * Returns all classification examples
 */
export async function GET() {
  try {
    const examples = await getExamples();

    return NextResponse.json({
      success: true,
      data: examples,
    });
  } catch (error) {
    console.error('Error fetching examples:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch examples',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/examples
 * Creates a new classification example from a lead
 * Body: { lead_id: string, sdr_reasoning: string, created_by: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lead_id, sdr_reasoning, created_by } = body;

    // Validate required fields
    if (!lead_id || typeof lead_id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'lead_id is required',
        },
        { status: 400 }
      );
    }

    if (!sdr_reasoning || typeof sdr_reasoning !== 'string' || sdr_reasoning.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'sdr_reasoning is required',
        },
        { status: 400 }
      );
    }

    if (!created_by || typeof created_by !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'created_by is required',
        },
        { status: 400 }
      );
    }

    const example = await createExample(lead_id, sdr_reasoning.trim(), created_by);

    return NextResponse.json({
      success: true,
      data: example,
    });
  } catch (error) {
    console.error('Error creating example:', error);

    // Handle specific errors
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create example',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { findRelevantCaseStudiesVectorWithReason } from '@/lib/case-study-vector-matcher';

/**
 * POST /api/case-studies/match
 * Find relevant case studies for a lead using vector matching
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company, message, maxResults = 1 } = body;

    if (!company || !message) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: company and message',
        },
        { status: 400 }
      );
    }

    const matches = await findRelevantCaseStudiesVectorWithReason(
      { company, message },
      maxResults
    );

    return NextResponse.json({
      success: true,
      data: matches,
    });
  } catch (error) {
    console.error('Error matching case studies:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to match case studies',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import {
  getCaseStudy,
  updateCaseStudy,
  deleteCaseStudy,
  validateCaseStudy,
} from '@/lib/firebase-case-studies';

/**
 * GET /api/case-studies/[id]
 * Returns a specific case study
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const caseStudy = await getCaseStudy(id);

    if (!caseStudy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Case study not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: caseStudy,
    });
  } catch (error) {
    console.error('Error fetching case study:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch case study',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/case-studies/[id]
 * Updates a case study
 * Supports partial updates (e.g., just logoSvg)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if this is a logoSvg-only or featuredText-only update (skip validation for these)
    const isMetadataOnlyUpdate =
      (Object.keys(body).length === 1 && 'logoSvg' in body) ||
      (Object.keys(body).length === 1 && 'featuredText' in body);

    if (!isMetadataOnlyUpdate) {
      // Validate the updates for full case study updates
      const validation = validateCaseStudy(body);
      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            errors: validation.errors,
          },
          { status: 400 }
        );
      }
    }

    await updateCaseStudy(id, body);

    return NextResponse.json({
      success: true,
      data: { id },
    });
  } catch (error) {
    console.error('Error updating case study:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update case study',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/case-studies/[id]
 * Deletes a case study
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteCaseStudy(id);

    return NextResponse.json({
      success: true,
      data: { id },
    });
  } catch (error) {
    console.error('Error deleting case study:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete case study',
      },
      { status: 500 }
    );
  }
}

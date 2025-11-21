import { NextRequest, NextResponse } from 'next/server';
import { getAllCaseStudies, createCaseStudy, validateCaseStudy } from '@/lib/firebase-case-studies';
import type { CaseStudy } from '@/lib/case-studies';

/**
 * GET /api/case-studies
 * Returns all case studies (excludes embeddings for performance)
 */
export async function GET() {
  try {
    const caseStudies = await getAllCaseStudies();

    // Strip embedding fields before sending to client
    const caseStudiesWithoutEmbeddings = caseStudies.map(({ id, company, industry, description, metrics, products, url, quote, quotedPerson }) => ({
      id,
      company,
      industry,
      description,
      metrics,
      products,
      url,
      quote,
      quotedPerson,
    }));

    return NextResponse.json({
      success: true,
      data: caseStudiesWithoutEmbeddings,
    });
  } catch (error) {
    console.error('Error fetching case studies:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch case studies',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/case-studies
 * Creates a new case study
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate the case study data
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

    // Create the case study
    const id = await createCaseStudy(body as Omit<CaseStudy, 'id'>);

    return NextResponse.json({
      success: true,
      data: { id },
    });
  } catch (error) {
    console.error('Error creating case study:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create case study',
      },
      { status: 500 }
    );
  }
}

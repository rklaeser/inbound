// POST /api/case-studies/[id]/logo - Upload a logo for a case study
// DELETE /api/case-studies/[id]/logo - Remove the logo for a case study

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, uploadCaseStudyLogo, deleteCaseStudyLogo } from '@/lib/db';

const MAX_FILE_SIZE = 100 * 1024; // 100KB
const ALLOWED_MIME_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if case study exists
    const caseStudyRef = adminDb.collection('case_studies').doc(id);
    const caseStudyDoc = await caseStudyRef.get();

    if (!caseStudyDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Case study not found' },
        { status: 404 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('logo') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Allowed: SVG, PNG, JPEG' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 100KB' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Firebase Storage
    const logoUrl = await uploadCaseStudyLogo(id, buffer, file.type);

    // Update case study document with logo URL
    await caseStudyRef.update({
      logoUrl,
      updated_at: new Date(),
    });

    return NextResponse.json({
      success: true,
      logoUrl,
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload logo' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if case study exists
    const caseStudyRef = adminDb.collection('case_studies').doc(id);
    const caseStudyDoc = await caseStudyRef.get();

    if (!caseStudyDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Case study not found' },
        { status: 404 }
      );
    }

    // Delete from Firebase Storage
    await deleteCaseStudyLogo(id);

    // Remove logo URL from case study document
    await caseStudyRef.update({
      logoUrl: null,
      updated_at: new Date(),
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting logo:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete logo' },
      { status: 500 }
    );
  }
}

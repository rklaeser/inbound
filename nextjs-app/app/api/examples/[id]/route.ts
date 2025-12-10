import { NextRequest, NextResponse } from 'next/server';
import {
  updateExampleStatus,
  deleteExample,
} from '@/lib/examples-service';
import type { ExampleStatus } from '@/lib/types';

/**
 * PATCH /api/examples/[id]
 * Updates example status (activate/deactivate)
 * Body: { status: 'active' | 'inactive' }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    // Validate status
    if (!status || !['active', 'inactive'].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'status must be "active" or "inactive"',
        },
        { status: 400 }
      );
    }

    await updateExampleStatus(id, status as ExampleStatus);

    return NextResponse.json({
      success: true,
      data: { id, status },
    });
  } catch (error) {
    console.error('Error updating example:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update example',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/examples/[id]
 * Deletes an example
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteExample(id);

    return NextResponse.json({
      success: true,
      data: { id },
    });
  } catch (error) {
    console.error('Error deleting example:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete example',
      },
      { status: 500 }
    );
  }
}

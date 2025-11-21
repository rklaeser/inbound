// GET /api/leads/[id]
// Get individual lead by ID

// PATCH /api/leads/[id]
// Update individual lead

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firestore-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch lead document
    const leadDoc = await adminDb.collection("leads").doc(id).get();

    if (!leadDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: "Lead not found",
        },
        { status: 404 }
      );
    }

    const leadData = leadDoc.data();

    return NextResponse.json({
      success: true,
      lead: {
        id: leadDoc.id,
        ...leadData,
      },
    });
  } catch (error) {
    console.error("Error fetching lead:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch lead",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if lead exists
    const leadDoc = await adminDb.collection("leads").doc(id).get();

    if (!leadDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: "Lead not found",
        },
        { status: 404 }
      );
    }

    // Update lead document
    // Filter out undefined values and id field
    const updateData: any = {};
    Object.keys(body).forEach((key) => {
      if (body[key] !== undefined && key !== "id") {
        updateData[key] = body[key];
      }
    });

    await adminDb.collection("leads").doc(id).update(updateData);

    // Fetch updated lead
    const updatedDoc = await adminDb.collection("leads").doc(id).get();
    const updatedData = updatedDoc.data();

    return NextResponse.json({
      success: true,
      lead: {
        id: updatedDoc.id,
        ...updatedData,
      },
    });
  } catch (error) {
    console.error("Error updating lead:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update lead",
      },
      { status: 500 }
    );
  }
}

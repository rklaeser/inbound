// POST /api/leads/[id]/self-service
// Handle support team marking a lead as self-service
// This is feedback-only - the lead has already been forwarded to support
// and the customer has already received an email. This just records that
// support didn't need to respond because the automated email was sufficient.

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firestore-admin";
import type { Lead } from "@/lib/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    const lead = { id: leadDoc.id, ...leadDoc.data() } as Lead;

    // Verify this is a support-classified lead
    const currentClassification = lead.classifications[0]?.classification;
    if (currentClassification !== "support") {
      return NextResponse.json(
        {
          success: false,
          error: "Self-service option is only available for support-classified leads",
        },
        { status: 400 }
      );
    }

    // Check if already marked as self-service
    if (lead.supportFeedback?.markedSelfService) {
      return NextResponse.json(
        {
          success: false,
          error: "This lead has already been marked as self-service",
        },
        { status: 400 }
      );
    }

    const now = new Date();

    // Just record the feedback - don't change classification or send emails
    await adminDb.collection("leads").doc(id).update({
      supportFeedback: {
        markedSelfService: true,
        timestamp: now,
      },
    });

    console.log(`Lead ${id} marked as self-service by Support Team`);

    return NextResponse.json({
      success: true,
      message: "Feedback recorded",
    });
  } catch (error) {
    console.error("Error processing self-service:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process request",
      },
      { status: 500 }
    );
  }
}

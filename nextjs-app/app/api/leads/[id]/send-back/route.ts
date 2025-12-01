// POST /api/leads/[id]/send-back
// Handle internal team (support/account) send-back when they dispute the classification

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firestore-admin";
import { z } from "zod";
import type { Lead, ClassificationEntry } from "@/lib/types";

// Validation schema
const sendBackSchema = z.object({
  team: z.enum(["support", "account"]),
  note: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validationResult = sendBackSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const { team, note } = validationResult.data;

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

    // Check if lead was previously classified as support or duplicate
    const currentClassification = lead.classifications[0]?.classification;
    if (currentClassification !== "support" && currentClassification !== "duplicate") {
      return NextResponse.json(
        {
          success: false,
          error: "Send-back is only available for support or duplicate classifications",
        },
        { status: 400 }
      );
    }

    const now = new Date();

    // Create new classification entry for internal-reroute
    const newClassificationEntry: ClassificationEntry = {
      author: "human",
      classification: "internal-reroute",
      timestamp: now,
    };

    // Update the lead
    const updatedClassifications = [newClassificationEntry, ...lead.classifications];

    // Build the note prefix based on team
    const teamLabel = team === "support" ? "Support Team" : "Account Team";
    const noteContent = note
      ? `[${teamLabel} Reroute] ${note}`
      : `[${teamLabel} Reroute] No additional context provided`;

    await adminDb.collection("leads").doc(id).update({
      // Add new classification
      classifications: updatedClassifications,
      // Set status to classify for fresh classification
      "status.status": "classify",
      // Store note in edit_note
      "edit_note": noteContent,
    });

    console.log(`Lead ${id} sent back by ${teamLabel}. Previous classification: ${currentClassification}`);

    return NextResponse.json({
      success: true,
      message: "Lead sent back successfully",
    });
  } catch (error) {
    console.error("Error processing send-back:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process send-back request",
      },
      { status: 500 }
    );
  }
}

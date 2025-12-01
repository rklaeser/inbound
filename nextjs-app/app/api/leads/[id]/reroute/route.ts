// POST /api/leads/[id]/reroute
// Handle customer reroute submission when they dispute support/duplicate classification

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firestore-admin";
import { z } from "zod";
import type { Lead, ClassificationEntry } from "@/lib/types";

// Validation schema
const rerouteSchema = z.object({
  additionalContext: z.string().min(1, "Additional context is required"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validationResult = rerouteSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const { additionalContext } = validationResult.data;

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
          error: "Reroute is only available for support or duplicate classifications",
        },
        { status: 400 }
      );
    }

    const now = new Date();

    // Create new classification entry for customer-reroute
    const newClassificationEntry: ClassificationEntry = {
      author: "human", // Marked as human since customer initiated
      classification: "customer-reroute",
      timestamp: now,
    };

    // Update the lead
    const updatedClassifications = [newClassificationEntry, ...lead.classifications];

    await adminDb.collection("leads").doc(id).update({
      // Add new classification
      classifications: updatedClassifications,
      // Set status to review so SDRs see it in their queue
      "status.status": "review",
      // Store additional context in edit_note
      "edit_note": `[Customer Reroute] ${additionalContext}`,
    });

    console.log(`Lead ${id} rerouted by customer. Previous classification: ${currentClassification}`);

    return NextResponse.json({
      success: true,
      message: "Reroute request submitted successfully",
    });
  } catch (error) {
    console.error("Error processing reroute:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process reroute request",
      },
      { status: 500 }
    );
  }
}

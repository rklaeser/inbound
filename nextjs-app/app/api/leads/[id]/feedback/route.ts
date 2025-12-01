// POST /api/leads/[id]/feedback
// Unified endpoint for lead feedback from customer, support, or sales

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/db";
import { z } from "zod";
import type { Lead, ClassificationEntry } from "@/lib/types";

// Validation schema
const feedbackSchema = z.object({
  source: z.enum(["customer", "support", "sales"]),
  reason: z.string().optional(),
  selfService: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validationResult = feedbackSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const { source, reason, selfService } = validationResult.data;

    // Customer feedback requires a reason
    if (source === "customer" && !reason?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Reason is required for customer feedback",
        },
        { status: 400 }
      );
    }

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
    const currentClassification = lead.classifications[0]?.classification;

    // Handle self-service (support only)
    if (source === "support" && selfService) {
      // Verify this is a support-classified lead
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

      // Just record the feedback - don't change classification or send emails
      await adminDb.collection("leads").doc(id).update({
        supportFeedback: {
          markedSelfService: true,
          timestamp: new Date(),
        },
      });

      console.log(`Lead ${id} marked as self-service by Support Team`);

      return NextResponse.json({
        success: true,
        message: "Feedback recorded",
      });
    }

    // For reroute requests, verify lead was classified as support or duplicate
    if (currentClassification !== "support" && currentClassification !== "duplicate") {
      return NextResponse.json(
        {
          success: false,
          error: "Feedback is only available for support or duplicate classifications",
        },
        { status: 400 }
      );
    }

    const now = new Date();

    // Determine classification type based on source
    const classificationTypeMap: Record<string, "customer-reroute" | "support-reroute" | "sales-reroute"> = {
      customer: "customer-reroute",
      support: "support-reroute",
      sales: "sales-reroute",
    };
    const classificationType = classificationTypeMap[source];

    // Create new classification entry
    const newClassificationEntry: ClassificationEntry = {
      author: "human",
      classification: classificationType,
      timestamp: now,
    };

    // Update the lead
    const updatedClassifications = [newClassificationEntry, ...lead.classifications];

    // Build the note prefix based on source
    const sourceLabels: Record<string, string> = {
      customer: "Customer Reroute",
      support: "Support Team Reroute",
      sales: "Sales Team Reroute",
    };
    const sourceLabel = sourceLabels[source];
    const noteContent = reason?.trim()
      ? `[${sourceLabel}] ${reason}`
      : `[${sourceLabel}] No additional context provided`;

    // Customer feedback goes to review, internal feedback goes to classify
    const newStatus = source === "customer" ? "review" : "classify";

    await adminDb.collection("leads").doc(id).update({
      classifications: updatedClassifications,
      "status.status": newStatus,
      edit_note: noteContent,
    });

    console.log(
      `Lead ${id} feedback from ${source}. Previous classification: ${currentClassification}`
    );

    return NextResponse.json({
      success: true,
      message: source === "customer" ? "Feedback submitted successfully" : "Lead sent back successfully",
    });
  } catch (error) {
    console.error("Error processing feedback:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process feedback",
      },
      { status: 500 }
    );
  }
}

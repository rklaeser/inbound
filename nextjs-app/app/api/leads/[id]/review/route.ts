// PATCH /api/leads/[id]/review
// Handle human review actions

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firestore-admin";
import { z } from "zod";
import { start } from "workflow/api";
import { workflowInbound } from "@/workflows/inbound";
import type { LeadFormData, Lead } from "@/lib/types";
import {
  logEmailEditEvent,
  logEmailApprovalEvent,
  logEmailRejectionEvent,
  logReclassificationEvent,
  logLeadForwardedEvent,
} from "@/lib/analytics-helpers";

// Validation schema for review actions
const reviewActionSchema = z.object({
  action: z.enum(["edit", "approve", "reject", "reclassify", "forward"]),
  email_subject: z.string().optional(),
  email_body: z.string().optional(),
  destination: z.enum(["support", "account_team"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validationResult = reviewActionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const { action, email_subject, email_body, destination } = validationResult.data;

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

    // Handle different actions
    switch (action) {
      case "edit":
        // Update email content and mark as edited
        if (!email_subject || !email_body) {
          return NextResponse.json(
            {
              success: false,
              error: "Email subject and body are required for edit action",
            },
            { status: 400 }
          );
        }

        const originalData = leadDoc.data() as Lead;
        const editedAt = new Date();

        // TODO: Replace hardcoded user with actual authenticated user
        const editedBy = "Ryan";

        await adminDb.collection("leads").doc(id).update({
          final_email_subject: email_subject,
          final_email_body: email_body,
          edited: true,
          edited_by: editedBy,
          edited_at: editedAt,
          reviewed_by: editedBy,
          reviewed_at: editedAt,
          outcome: "pending", // Keep in pending state after editing (autonomy stays 'review')
        });

        // Log email edit event
        await logEmailEditEvent(
          { ...originalData, id } as Lead,
          originalData.generated_email_subject || "",
          originalData.generated_email_body || "",
          email_subject,
          email_body
        );
        break;

      case "approve":
        // Mark as sent (meeting offer or generic based on classification)
        const approvalData = leadDoc.data() as Lead;
        const closedAt = new Date();

        // TODO: Replace hardcoded user with actual authenticated user
        const closedBy = "Ryan";

        // Determine outcome based on classification
        // Quality leads get "sent_meeting_offer", others get "sent_generic"
        const sentOutcome = approvalData.classification === 'quality'
          ? 'sent_meeting_offer'
          : 'sent_generic';

        await adminDb.collection("leads").doc(id).update({
          outcome: sentOutcome,
          closed_at: closedAt,
          closed_by: closedBy,
          reviewed_by: closedBy,
          reviewed_at: closedAt,
        });

        // Log email approval event
        const timeToApprovalMs = closedAt.getTime() - (approvalData.created_at as any).toDate().getTime();
        await logEmailApprovalEvent(
          { ...approvalData, id } as Lead,
          timeToApprovalMs
        );
        break;

      case "reject":
        // Mark as dead
        const rejectData = leadDoc.data() as Lead;
        const rejectClosedAt = new Date();

        // TODO: Replace hardcoded user with actual authenticated user
        const rejectClosedBy = "Ryan";

        await adminDb.collection("leads").doc(id).update({
          outcome: "dead",
          closed_by: rejectClosedBy,
          closed_at: rejectClosedAt,
          reviewed_by: rejectClosedBy,
          reviewed_at: rejectClosedAt,
        });

        // Log email rejection event
        await logEmailRejectionEvent(
          { ...rejectData, id } as Lead,
          "manual_rejection"
        );
        break;

      case "reclassify":
        // Get lead data for workflow
        const leadData = leadDoc.data() as any;
        const oldClassification = leadData.classification;

        const leadFormData: LeadFormData = {
          name: leadData.name,
          email: leadData.email,
          company: leadData.company,
          message: leadData.message,
        };

        // Log reclassification event (with old classification, new will be logged when re-qualified)
        if (oldClassification) {
          await logReclassificationEvent(
            { ...leadData, id } as Lead,
            oldClassification,
            "pending_reclassification"
          );
        }

        // Reset lead and trigger re-classification
        await adminDb.collection("leads").doc(id).update({
          autonomy: null,
          outcome: null,
          classification: null,
          confidence_score: null,
          reasoning: null,
          generated_email_subject: null,
          generated_email_body: null,
          final_email_subject: null,
          final_email_body: null,
          edited: false,
          classified_at: null,
          updated_at: new Date(),
        });

        // Trigger workflow asynchronously
        start(workflowInbound, [leadFormData]).catch((error) => {
          console.error("Error triggering reclassification:", error);
          adminDb.collection("leads").doc(id).update({
            outcome: "error",
            error_message: error.message || "Reclassification workflow error",
            updated_at: new Date(),
          });
        });
        break;

      case "forward":
        // Forward lead to support or account team
        if (!destination) {
          return NextResponse.json(
            {
              success: false,
              error: "Destination is required for forward action",
            },
            { status: 400 }
          );
        }

        const forwardData = leadDoc.data() as Lead;
        const forwardClosedAt = new Date();

        // TODO: Replace hardcoded user with actual authenticated user
        const forwardClosedBy = "Ryan";

        // Set specific outcome based on destination
        const forwardOutcome = destination === 'support' ? 'forwarded_support' : 'forwarded_account_team';

        await adminDb.collection("leads").doc(id).update({
          forwarded_to: destination,
          closed_by: forwardClosedBy,
          closed_at: forwardClosedAt,
          reviewed_by: forwardClosedBy,
          reviewed_at: forwardClosedAt,
          outcome: forwardOutcome,
        });

        // Log lead forwarded event
        await logLeadForwardedEvent(
          { ...forwardData, id } as Lead,
          destination,
          forwardClosedBy
        );
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action",
          },
          { status: 400 }
        );
    }

    // Fetch updated lead
    const updatedDoc = await adminDb.collection("leads").doc(id).get();
    const updatedData = updatedDoc.data();

    return NextResponse.json({
      success: true,
      action,
      lead: {
        id: updatedDoc.id,
        ...updatedData,
      },
    });
  } catch (error) {
    console.error("Error processing review action:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process review action",
      },
      { status: 500 }
    );
  }
}

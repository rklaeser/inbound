// POST /api/leads/submit
// Accept new lead from form submission

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firestore-admin";
import type { LeadFormData } from "@/lib/types";
import { z } from "zod";
import { start } from "workflow/api";
import { workflowInbound } from "@/workflows/inbound";
import { getActiveConfiguration } from "@/lib/configuration-helpers";

// Validation schema
const leadFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  company: z.string().min(1, "Company is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
  metadata: z.object({
    isTestLead: z.boolean(),
    testCase: z.string(),
    expectedClassifications: z.array(z.string()),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate input
    const validationResult = leadFormSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const leadData: LeadFormData = validationResult.data;

    // Get active configuration to tag this lead with
    let activeConfiguration;
    try {
      activeConfiguration = await getActiveConfiguration();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: "System is not configured. Please contact support.",
        },
        { status: 503 } // Service Unavailable
      );
    }

    // Create lead document in Firestore
    const leadRef = await adminDb.collection("leads").add({
      // Lead information
      name: leadData.name,
      email: leadData.email,
      company: leadData.company,
      message: leadData.message,

      // Classification (initially null)
      classification: null,
      confidence_score: null,
      reasoning: null,

      // Research data (initially null)
      research_report: null,
      person_job_title: null,
      person_linkedin_url: null,

      // Email generation (initially null)
      generated_email_subject: null,
      generated_email_body: null,
      final_email_subject: null,
      final_email_body: null,
      edited: false,

      // New data model - autonomy and outcome (initially null = processing)
      autonomy: null,
      outcome: null,

      // Configuration tracking
      configuration_id: activeConfiguration.id,

      // Test metadata (optional - only for test leads)
      ...(leadData.metadata && { metadata: leadData.metadata }),

      // Timestamps
      created_at: new Date(),
      classified_at: null,
      reviewed_at: null,
      edited_at: null,
      closed_at: null,
      meeting_booked_at: null,

      // Attribution tracking
      reviewed_by: null,
      edited_by: null,
      closed_by: null,
      forwarded_to: null,
    });

    const leadId = leadRef.id;

    // Trigger workflow asynchronously and handle completion
    // start() returns a Run handle - we need to await run.returnValue to get the actual result
    start(workflowInbound, [leadData])
      .then(async (run) => {
        console.log(`[API] Workflow started with run ID: ${run.runId}`);

        // Poll for the workflow result
        return run.returnValue;
      })
      .then(async (result) => {
        console.log(`[API] Workflow completed for lead ${leadId}`);

        // Validate result before processing
        if (!result || !result.qualification) {
          console.error(`[API] Workflow returned invalid result for lead ${leadId}:`, result);
          await adminDb.collection("leads").doc(leadId).update({
            outcome: "error",
            error_message: "Workflow returned invalid result",
            updated_at: new Date(),
          });
          return;
        }

        // Workflow completed successfully - write all results to Firestore
        const updateData: any = {
          // Research results
          research_report: result.research.report,
          person_job_title: result.research.jobTitle,
          person_linkedin_url: result.research.linkedinUrl,

          // Classification results
          classification: result.qualification.classification,
          confidence_score: result.qualification.confidence,
          reasoning: result.qualification.reasoning,
          classified_at: new Date(),

          // Autonomy and outcome (replaces status)
          autonomy: result.autonomy,
          outcome: result.outcome,

          // Timestamps
          updated_at: new Date(),
        };

        // Add email data if generated
        if (result.email) {
          updateData.generated_email_subject = result.email.subject;
          updateData.generated_email_body = result.email.body;
        }

        await adminDb.collection("leads").doc(leadId).update(updateData);

        // Log analytics events
        const leadDoc = await adminDb.collection("leads").doc(leadId).get();
        const leadWithResults = { id: leadDoc.id, ...leadDoc.data() };

        const { logClassificationEvent, logEmailGenerationEvent } = await import('@/lib/analytics-helpers');

        // Log classification event
        await logClassificationEvent(
          leadWithResults as any,
          result.qualification.classification,
          result.qualification.confidence,
          result.qualification.reasoning
        );

        // Log email generation event if email was generated
        if (result.email) {
          await logEmailGenerationEvent(
            leadWithResults as any,
            result.email.subject,
            result.email.body
          );
        }

        console.log(`[API] Workflow completed successfully for lead ${leadId}`);
      })
      .catch(async (error) => {
        console.error(`[API] Workflow failed for lead ${leadId}:`, error);
        // Update lead outcome to error with error message for debugging
        await adminDb.collection("leads").doc(leadId).update({
          outcome: "error",
          error_message: error.message || "Unknown workflow error",
          updated_at: new Date(),
        });
      });

    return NextResponse.json({
      success: true,
      leadId,
    });
  } catch (error) {
    console.error("Failed to save lead to Firestore:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Unable to submit your inquiry. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}

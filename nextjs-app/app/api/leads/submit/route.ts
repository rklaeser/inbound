// POST /api/leads/submit
// Accept new lead from form submission

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firestore-admin";
import type { LeadFormData, Lead, Classification } from "@/lib/types";
import { z } from "zod";
import { start } from "workflow/api";
import { workflowInbound } from "@/workflows/inbound";

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

    const leadData = validationResult.data;
    const now = new Date();

    // Create initial lead document with new data model
    const initialLead: Omit<Lead, 'id'> = {
      // Submission data
      submission: {
        leadName: leadData.name,
        email: leadData.email,
        company: leadData.company,
        message: leadData.message,
      },

      // Bot outputs (null until workflow completes)
      bot_research: null,
      bot_text: null,
      bot_rollout: null,

      // Human edits (null until edited)
      human_edits: null,

      // Status
      status: {
        status: 'review',  // Start in review, workflow may change to done
        received_at: now,
        sent_at: null,
        sent_by: null,
      },

      // Classification history (empty until workflow completes)
      classifications: [],

      // Test metadata (optional)
      ...(leadData.metadata && {
        metadata: {
          isTestLead: leadData.metadata.isTestLead,
          testCase: leadData.metadata.testCase,
          expectedClassifications: leadData.metadata.expectedClassifications as Classification[],
        }
      }),
    };

    // Create lead document in Firestore
    const leadRef = await adminDb.collection("leads").add(initialLead);
    const leadId = leadRef.id;

    // Trigger workflow asynchronously
    start(workflowInbound, [leadData])
      .then(async (run) => {
        console.log(`[API] Workflow started with run ID: ${run.runId}`);
        return run.returnValue;
      })
      .then(async (result) => {
        console.log(`[API] Workflow completed for lead ${leadId}`);

        // Validate result
        if (!result || !result.bot_research) {
          console.error(`[API] Workflow returned invalid result for lead ${leadId}:`, result);
          // Mark as needing review with error note
          await adminDb.collection("leads").doc(leadId).update({
            'status.status': 'review',
          });
          return;
        }

        // Build bot classification entry
        const botClassification = {
          author: 'bot' as const,
          classification: result.bot_research.classification,
          timestamp: result.bot_research.timestamp,
          needs_review: result.needs_review,
          applied_threshold: result.applied_threshold,
        };

        // Build bot rollout info
        const bot_rollout = {
          rollOut: result.applied_threshold,  // Store the threshold used
          useBot: result.status === 'done',   // true if auto-sent
        };

        // Update lead with workflow results
        // Note: bot_text now contains only the AI-generated body content
        // Full email is assembled at display/send time using templates from configuration
        await adminDb.collection("leads").doc(leadId).update({
          // Bot research
          bot_research: result.bot_research,

          // Bot text (AI-generated body content only)
          bot_text: result.bot_text,

          // Bot rollout decision
          bot_rollout: bot_rollout,

          // Status
          'status.status': result.status,
          'status.sent_at': result.sent_at,
          'status.sent_by': result.sent_by,

          // Add bot classification to history
          classifications: [botClassification],
        });

        // Log analytics events
        const { logClassificationEvent, logEmailGenerationEvent } = await import('@/lib/analytics-helpers');

        // Get updated lead for analytics
        const leadDoc = await adminDb.collection("leads").doc(leadId).get();
        const leadWithResults = { id: leadDoc.id, ...leadDoc.data() } as Lead;

        // Log classification event
        await logClassificationEvent(
          leadWithResults,
          result.bot_research.classification,
          result.bot_research.confidence,
          result.bot_research.reasoning
        );

        // Log email generation event if emails were generated
        if (result.bot_text) {
          await logEmailGenerationEvent(
            leadWithResults,
            'Generated',  // Subject placeholder
            result.bot_text.highQualityText
          );
        }

        console.log(`[API] Workflow completed successfully for lead ${leadId}`);
      })
      .catch(async (error) => {
        console.error(`[API] Workflow failed for lead ${leadId}:`, error);
        // Keep lead in review state - human will need to handle
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

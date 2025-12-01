// POST /api/leads/submit
// Accept new lead from form submission

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firestore-admin";
import type { Lead, Classification, LeadStatus, BotResearch, Email } from "@/lib/types";
import { z } from "zod";
import { start } from "workflow/api";
import { workflowInbound } from "@/workflows/inbound";
import { getConfiguration } from "@/lib/configuration-helpers";
import { getCachedCaseStudies } from "@/lib/case-study-matcher";
import { detectDuplicate } from "@/lib/salesforce-mock";
import { assembleEmail, extractFirstName } from "@/lib/email-helpers";

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

    // Step 1: Check for duplicates BEFORE any AI processing
    // This is deterministic and should always run regardless of AI classification rate
    const duplicateResult = detectDuplicate(leadData.email, leadData.company);

    if (duplicateResult.isDuplicate && duplicateResult.matchedContact) {
      console.log(`[API] Duplicate detected: ${duplicateResult.matchReason}`);

      // Create bot_research for the duplicate
      const bot_research: BotResearch = {
        timestamp: now,
        confidence: 0.99,
        classification: 'duplicate',
        reasoning: `CRM match: ${duplicateResult.matchReason}. Customer: ${duplicateResult.matchedContact.company} (${duplicateResult.matchedContact.accountType})`,
        existingCustomer: true,
        crmRecordId: duplicateResult.matchedContact.id,
      };

      // Create lead document marked as done (auto-forwarded)
      const duplicateLead: Omit<Lead, 'id'> = {
        submission: {
          leadName: leadData.name,
          email: leadData.email,
          company: leadData.company,
          message: leadData.message,
        },
        bot_research,
        bot_rollout: {
          rollOut: 0,
          useBot: true,
        },
        email: null,  // No email for duplicates
        status: {
          status: 'done',
          received_at: now,
          sent_at: now,
          sent_by: 'system',  // Deterministic rule, not AI
        },
        classifications: [{
          author: 'bot',
          classification: 'duplicate',
          timestamp: now,
          needs_review: false,
          applied_threshold: 0,
        }],
        matched_case_studies: [],
        ...(leadData.metadata && {
          metadata: {
            isTestLead: leadData.metadata.isTestLead,
            testCase: leadData.metadata.testCase,
            expectedClassifications: leadData.metadata.expectedClassifications as Classification[],
          }
        }),
      };

      const leadRef = await adminDb.collection("leads").add(duplicateLead);

      console.log(`[API] Duplicate lead ${leadRef.id} auto-forwarded to account team`);

      return NextResponse.json({
        success: true,
        leadId: leadRef.id,
        isDuplicate: true,
        matchedCustomer: duplicateResult.matchedContact.company,
      });
    }

    // Step 2: Check AI classification rate to determine routing for non-duplicates
    // Even when human classifies, we still run AI silently for comparison
    const config = await getConfiguration();
    const aiClassificationRate = config.rollout?.percentage || 0;
    const useAIClassification = Math.random() < aiClassificationRate;

    // Determine initial status based on AI classification rate
    // If AI will classify: start in 'review' (workflow will update based on confidence)
    // If human will classify: start in 'classify' (human must classify, but AI runs silently)
    const initialStatus: LeadStatus = useAIClassification ? 'review' : 'classify';

    console.log(`[API] AI Classification Rate: ${aiClassificationRate * 100}%, useAI: ${useAIClassification}, initialStatus: ${initialStatus}`);

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
      bot_rollout: null,

      // Email content (null until generated by workflow)
      email: null,

      // Status
      status: {
        status: initialStatus,  // 'classify' if human will classify, 'review' if AI will classify
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

    // Pre-fetch case studies for the workflow (workflow runtime lacks setTimeout for Firebase)
    // Strip Firestore Timestamp fields that can't be serialized by workflow runtime
    const rawCaseStudies = await getCachedCaseStudies();
    const caseStudies = rawCaseStudies.map(cs => ({
      id: cs.id,
      company: cs.company,
      industry: cs.industry,
      products: cs.products,
      url: cs.url,
      logoSvg: cs.logoSvg,
      featuredText: cs.featuredText,
    }));

    // Always trigger workflow - AI classification runs for comparison even when human will classify
    // The difference is in how we handle the result:
    // - useAIClassification=true: Bot classification is authoritative, lead goes to review/done
    // - useAIClassification=false: Bot classification is stored for comparison only, human must classify
    start(workflowInbound, [{
      lead: leadData,
      caseStudies,
      config: {
        thresholds: config.thresholds,
        rollout: config.rollout,
        allowHighQualityAutoSend: config.allowHighQualityAutoSend,
      }
    }])
      .then(async (run) => {
        console.log(`[API] Workflow started with run ID: ${run.runId}`);
        return run.returnValue;
      })
      .then(async (result) => {
        console.log(`[API] Workflow completed for lead ${leadId}, useAIClassification: ${useAIClassification}`);

        // Validate result
        if (!result || !result.bot_research) {
          console.error(`[API] Workflow returned invalid result for lead ${leadId}:`, result);
          // Move lead to 'classify' so human can handle it
          await adminDb.collection("leads").doc(leadId).update({
            'status.status': 'classify',
          });
          console.log(`[API] Lead ${leadId} moved to 'classify' due to invalid workflow result`);
          return;
        }

        // Assemble full email from body if workflow generated one
        // Note: Case studies are NOT included here - they're appended at send time
        // This keeps email.text clean for the editor UI
        let email: Email | null = null;
        if (result.emailBody) {
          const now = new Date();
          const firstName = extractFirstName(leadData.name);
          const fullEmailHtml = assembleEmail(
            result.emailBody,
            {
              greeting: config.emailTemplates.highQuality.greeting,
              callToAction: config.emailTemplates.highQuality.callToAction,
              signOff: config.emailTemplates.highQuality.signOff,
              senderName: config.sdr.name,
              senderLastName: config.sdr.lastName,
              senderEmail: config.sdr.email,
              senderTitle: config.sdr.title,
            },
            firstName,
            leadId
            // Case studies omitted - appended at send time in review route
          );
          email = {
            text: fullEmailHtml,
            createdAt: now,
            editedAt: now,
          };
          console.log(`[API] Assembled full email for ${firstName}`);
        }

        // Build bot rollout info
        const bot_rollout = {
          rollOut: result.applied_threshold,  // Store the threshold used
          useBot: useAIClassification && result.status === 'done',   // true if auto-sent
        };

        if (useAIClassification) {
          // AI is authoritative - apply bot classification and status
          const botClassification = {
            author: 'bot' as const,
            classification: result.bot_research.classification,
            timestamp: result.bot_research.timestamp,
            needs_review: result.needs_review,
            applied_threshold: result.applied_threshold,
          };

          // Update lead with full workflow results
          await adminDb.collection("leads").doc(leadId).update({
            // Bot research (always stored for comparison)
            bot_research: result.bot_research,

            // Email content (fully assembled HTML)
            email: email,

            // Bot rollout decision
            bot_rollout: bot_rollout,

            // Status - AI determines status
            'status.status': result.status,
            'status.sent_at': result.sent_at,
            'status.sent_by': result.sent_by,

            // Add bot classification to history (authoritative)
            classifications: [botClassification],

            // Case studies for customer-facing display
            matched_case_studies: result.matched_case_studies,
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

          // Log email generation event if email was generated
          if (email?.text) {
            await logEmailGenerationEvent(
              leadWithResults,
              'Generated',  // Subject placeholder
              email.text
            );
          }
        } else {
          // Human will classify - store AI results for comparison only
          // Don't add to classifications array, keep status as 'classify'
          await adminDb.collection("leads").doc(leadId).update({
            // Bot research stored for comparison
            bot_research: result.bot_research,

            // Email stored in case human agrees with AI
            email: email,

            // Bot rollout info
            bot_rollout: bot_rollout,

            // Status stays as 'classify' - human must classify
            // classifications array stays empty - human classification will be first

            // Case studies for customer-facing display
            matched_case_studies: result.matched_case_studies,
          });

          console.log(`[API] AI classification stored for comparison: ${result.bot_research.classification} (${(result.bot_research.confidence * 100).toFixed(0)}% confidence)`);
        }

        console.log(`[API] Workflow completed successfully for lead ${leadId}`);
      })
      .catch(async (error) => {
        console.error(`[API] Workflow failed for lead ${leadId}:`, error);
        // Move lead to 'classify' so human can classify it
        try {
          await adminDb.collection("leads").doc(leadId).update({
            'status.status': 'classify',
          });
          console.log(`[API] Lead ${leadId} moved to 'classify' for human handling`);
        } catch (updateError) {
          console.error(`[API] Failed to update lead status after workflow error:`, updateError);
        }
      });

    return NextResponse.json({
      success: true,
      leadId,
      aiClassified: useAIClassification,
      aiComparisonPending: !useAIClassification, // AI runs for comparison even when human classifies
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

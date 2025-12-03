// POST /api/leads/[id]/review/reclassify
// Reclassify a lead to a different classification

import { NextRequest } from "next/server";
import { adminDb } from "@/lib/db";
import { z } from "zod";
import type { Lead, Classification, ClassificationEntry } from "@/lib/types";
import { successResponse, ApiErrors } from "@/lib/api";
import { logReclassificationEvent, logLeadForwardedEvent } from "@/lib/analytics-helpers";
import { getConfiguration } from "@/lib/configuration-helpers";
import { extractFirstName, assembleEmail } from "@/lib/email";
import {
  sendLowQualityEmail,
  sendSupportEmail,
  sendExistingEmail,
} from "@/lib/email/classification-emails";
import { generateEmailForLead } from "@/lib/workflow-services";

const reclassifySchema = z.object({
  new_classification: z.enum(["high-quality", "low-quality", "support", "existing"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validationResult = reclassifySchema.safeParse(body);
    if (!validationResult.success) {
      return ApiErrors.validationError(validationResult.error.errors);
    }

    const { new_classification } = validationResult.data;

    // Check if lead exists
    const leadDoc = await adminDb.collection("leads").doc(id).get();
    if (!leadDoc.exists) {
      return ApiErrors.notFound("Lead");
    }

    const lead = { id: leadDoc.id, ...leadDoc.data() } as Lead;
    const now = new Date();
    const oldClassification = lead.classifications[0]?.classification;

    // Create new classification entry
    const newClassificationEntry: ClassificationEntry = {
      author: "human",
      classification: new_classification as Classification,
      timestamp: now,
    };

    // Update classifications array (prepend new entry)
    const updatedClassifications = [newClassificationEntry, ...lead.classifications];
    const updateData: Record<string, unknown> = {
      classifications: updatedClassifications,
    };

    // For high-quality: generate email and explicitly set to review status
    // High-quality leads should NEVER auto-send - they always need human review
    if (new_classification === "high-quality") {
      // Explicitly set status to review so human can edit and approve email
      updateData["status.status"] = "review";

      try {
        const leadData = {
          name: lead.submission.leadName,
          email: lead.submission.email,
          company: lead.submission.company,
          message: lead.submission.message,
        };
        const emailGenerated = await generateEmailForLead(
          leadData,
          lead.bot_research?.researchReport || ''
        );

        // Assemble the full email (greeting + body + CTA + signoff + signature)
        // Note: CTA is conditionally included based on responseStyle (skipped for 'qualifying')
        const config = await getConfiguration();
        const firstName = extractFirstName(lead.submission.leadName);
        const fullEmail = assembleEmail(
          emailGenerated.body,
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
          lead.id,
          undefined, // caseStudies
          emailGenerated.responseStyle
        );

        updateData["email.text"] = fullEmail;
        updateData["email.createdAt"] = now;
        updateData["email.editedAt"] = now;
      } catch (err) {
        console.error("Failed to generate high-quality email on reclassify:", err);
        // Continue without generating email - human can write it manually
      }
      // Update classification and status to review for email approval
      await adminDb.collection("leads").doc(id).update(updateData);
    } else {
      // For support, existing, low-quality: send email first, then update status
      const config = await getConfiguration();
      const testModeEmail = config.email.testMode ? config.email.testEmail : null;

      let emailSent = false;
      let sentEmailContent: { subject: string; html: string } | null = null;

      if (new_classification === "low-quality") {
        const result = await sendLowQualityEmail({ lead, config, testModeEmail });
        emailSent = result.success;
        sentEmailContent = result.sentContent;
      } else if (new_classification === "support") {
        const result = await sendSupportEmail({ lead, config, testModeEmail });
        emailSent = result.success;
        sentEmailContent = result.sentContent;
      } else if (new_classification === "existing") {
        const result = await sendExistingEmail({ lead, config, testModeEmail });
        emailSent = result.success;
        sentEmailContent = result.sentContent;
      }

      // Only mark as done if email was sent successfully (or email is disabled)
      if (emailSent || !config.email.enabled) {
        updateData["status.status"] = "done";
        updateData["status.sent_at"] = now;
        updateData["status.sent_by"] = config.sdr.name; // Uses configured SDR name
        if (sentEmailContent) {
          updateData.sent_email = sentEmailContent;
        }

        // Log forwarding events for auto-forwarded classifications
        if (new_classification === "support") {
          await logLeadForwardedEvent(lead, "support", "system");
        } else if (new_classification === "existing") {
          await logLeadForwardedEvent(lead, "account_team", "system");
        }
      }

      await adminDb.collection("leads").doc(id).update(updateData);
    }

    // Log reclassification event
    if (oldClassification) {
      await logReclassificationEvent(lead, oldClassification, new_classification);
    }

    // Fetch updated lead
    const updatedDoc = await adminDb.collection("leads").doc(id).get();
    return successResponse({ lead: { id: updatedDoc.id, ...updatedDoc.data() } });
  } catch (error) {
    console.error("Error reclassifying lead:", error);
    return ApiErrors.internal("Failed to reclassify lead");
  }
}

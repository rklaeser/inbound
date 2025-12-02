// POST /api/leads/[id]/review/approve
// Approve and send email for a lead in review status

import { NextRequest } from "next/server";
import { adminDb, toMillis } from "@/lib/db";
import type { Lead } from "@/lib/types";
import { successResponse, ApiErrors } from "@/lib/api";
import { logEmailApprovalEvent, logLeadForwardedEvent } from "@/lib/analytics-helpers";
import { getConfiguration } from "@/lib/configuration-helpers";
import {
  sendHighQualityEmail,
  sendLowQualityEmail,
  sendSupportEmail,
  sendExistingEmail,
} from "@/lib/email/classification-emails";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if lead exists
    const leadDoc = await adminDb.collection("leads").doc(id).get();
    if (!leadDoc.exists) {
      return ApiErrors.notFound("Lead");
    }

    const lead = { id: leadDoc.id, ...leadDoc.data() } as Lead;
    const now = new Date();
    const config = await getConfiguration();
    const currentClassification = lead.classifications[0]?.classification;

    if (!currentClassification) {
      return ApiErrors.badRequest("Lead has no classification");
    }

    // Helper to check if customer email should be sent based on responseToLead settings
    const shouldSendCustomerEmail = (classification: string): boolean => {
      if (classification === 'high-quality') return true;
      if (classification === 'low-quality') return config.responseToLead?.lowQuality ?? false;
      if (classification === 'support') return config.responseToLead?.support ?? false;
      if (classification === 'existing') return config.responseToLead?.existing ?? false;
      return false;
    };

    // Send email based on classification
    let emailSent = false;
    let sentEmailContent: { subject: string; html: string } | null = null;
    const testModeEmail = config.email.testMode ? config.email.testEmail : null;

    if (currentClassification === "high-quality") {
      const result = await sendHighQualityEmail({
        lead,
        config,
        testModeEmail,
        matchedCaseStudies: lead.matched_case_studies,
      });
      emailSent = result.success;
      sentEmailContent = result.sentContent;
    } else if (currentClassification === "low-quality") {
      if (shouldSendCustomerEmail("low-quality")) {
        const result = await sendLowQualityEmail({ lead, config, testModeEmail });
        emailSent = result.success;
        sentEmailContent = result.sentContent;
      } else {
        // No email sent, but still mark as done
        emailSent = true;
        sentEmailContent = null;
      }
    } else if (currentClassification === "support") {
      const skipCustomer = !shouldSendCustomerEmail("support");
      const result = await sendSupportEmail({ lead, config, testModeEmail, skipCustomerEmail: skipCustomer });
      emailSent = result.success;
      sentEmailContent = result.sentContent;
    } else if (currentClassification === "existing") {
      const skipCustomer = !shouldSendCustomerEmail("existing");
      const result = await sendExistingEmail({ lead, config, testModeEmail, skipCustomerEmail: skipCustomer });
      emailSent = result.success;
      sentEmailContent = result.sentContent;
    }

    // Only mark as done if email was sent successfully (or email is disabled)
    if (!emailSent && config.email.enabled) {
      return ApiErrors.internal("Failed to send email. Please try again.");
    }

    const updateData: Record<string, unknown> = {
      "status.status": "done",
      "status.sent_at": now,
      "status.sent_by": config.sdr.name, // Uses configured SDR name
    };
    if (sentEmailContent) {
      updateData.sent_email = sentEmailContent;
    }
    await adminDb.collection("leads").doc(id).update(updateData);

    // Log approval event
    const timeToApprovalMs = now.getTime() - toMillis(lead.status.received_at);
    await logEmailApprovalEvent(lead, timeToApprovalMs);

    // Log forwarding if it's a support/existing customer lead
    if (currentClassification === "support") {
      await logLeadForwardedEvent(lead, "support", "system");
    } else if (currentClassification === "existing") {
      await logLeadForwardedEvent(lead, "account_team", "system");
    }

    // Fetch updated lead
    const updatedDoc = await adminDb.collection("leads").doc(id).get();
    return successResponse({ lead: { id: updatedDoc.id, ...updatedDoc.data() } });
  } catch (error) {
    console.error("Error approving lead:", error);
    return ApiErrors.internal("Failed to approve lead");
  }
}

// PATCH /api/leads/[id]/review
// Handle human review actions: approve, edit, reclassify

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firestore-admin";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import type { Lead, Classification, ClassificationEntry } from "@/lib/types";
import {
  logEmailEditEvent,
  logEmailApprovalEvent,
  logReclassificationEvent,
  logLeadForwardedEvent,
} from "@/lib/analytics-helpers";
import { getConfiguration } from "@/lib/configuration-helpers";
import { sendEmail } from "@/lib/send-email";
import { extractFirstName, getEmailBody, assembleEmail } from "@/lib/email-helpers";
import { generateEmailForLead } from "@/lib/workflow-services";

// Validation schema for review actions
const reviewActionSchema = z.object({
  action: z.enum(["approve", "edit", "reclassify"]),
  // For edit action
  email_text: z.string().optional(),
  edit_note: z.string().optional(),
  // For reclassify action
  new_classification: z.enum(["high-quality", "low-quality", "support", "duplicate", "irrelevant"]).optional(),
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

    const { action, email_text, edit_note, new_classification } = validationResult.data;

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

    // Handle different actions
    switch (action) {
      case "approve": {
        // Approve: Set status to done, set sent_at, and send email
        const now = new Date();
        const config = await getConfiguration();
        const currentClassification = lead.classifications[0]?.classification;

        // Send email if enabled and classification requires it
        let emailResult = null;
        if (config.email.enabled && currentClassification) {
          const firstName = extractFirstName(lead.submission.leadName);
          const testModeEmail = config.email.testMode ? config.email.testEmail : null;

          // Determine which email to send based on classification
          if (currentClassification === "high-quality") {
            // Get the email body (human-edited or AI-generated)
            const bodyContent = getEmailBody(lead);

            if (bodyContent) {
              // Get template for high-quality
              const templateConfig = config.emailTemplates.highQuality;
              const senderName = config.sdr.name;
              const senderEmail = config.sdr.email;

              // Assemble full email
              const fullEmail = assembleEmail(
                bodyContent,
                { ...templateConfig, senderName, senderEmail },
                firstName,
                lead.id
              );

              // Send the email
              emailResult = await sendEmail(
                {
                  to: lead.submission.email,
                  fromName: senderName,
                  fromEmail: senderEmail,
                  subject: templateConfig.subject.replace('{firstName}', firstName),
                  html: fullEmail,
                },
                testModeEmail
              );

              console.log(`Email send result for lead ${id}:`, emailResult);
            }
          } else if (currentClassification === "low-quality") {
            // Low-quality uses static HTML template directly
            const template = config.emailTemplates.lowQuality;

            emailResult = await sendEmail(
              {
                to: lead.submission.email,
                fromName: template.senderName,
                fromEmail: template.senderEmail,
                subject: template.subject,
                html: template.body,
              },
              testModeEmail
            );

            console.log(`Email send result for lead ${id}:`, emailResult);
          } else if (currentClassification === "support") {
            // Send acknowledgment to lead
            const template = config.emailTemplates.support;
            const fullEmail = assembleEmail(
              "Thank you for reaching out. We've received your request and our support team will be in touch shortly.",
              { ...template, senderName: template.senderName || "Support", senderEmail: template.senderEmail || config.supportTeam.email },
              firstName,
              lead.id
            );

            emailResult = await sendEmail(
              {
                to: lead.submission.email,
                fromName: template.senderName || "Vercel Support",
                fromEmail: template.senderEmail || config.supportTeam.email,
                subject: template.subject.replace('{firstName}', firstName),
                html: fullEmail,
              },
              testModeEmail
            );

            // Also send internal notification to support team (plain text converted to simple HTML)
            const internalTemplate = config.emailTemplates.supportInternal;
            const internalBody = internalTemplate.body
              .replace('{firstName}', firstName)
              .replace('{company}', lead.submission.company)
              .replace('{email}', lead.submission.email)
              .replace('{message}', lead.submission.message);
            await sendEmail(
              {
                to: config.supportTeam.email,
                fromName: "Inbound System",
                fromEmail: "noreply@vercel.com",
                subject: internalTemplate.subject
                  .replace('{firstName}', firstName)
                  .replace('{company}', lead.submission.company),
                html: `<pre style="font-family: sans-serif; white-space: pre-wrap;">${internalBody}</pre>`,
              },
              testModeEmail
            );
          } else if (currentClassification === "duplicate") {
            // Send acknowledgment to lead
            const template = config.emailTemplates.duplicate;
            const fullEmail = assembleEmail(
              "Thank you for reaching out. Since you're already a valued Vercel customer, we've routed your inquiry directly to your account team.",
              { ...template, senderName: template.senderName || "Vercel", senderEmail: template.senderEmail || config.sdr.email },
              firstName,
              lead.id
            );

            emailResult = await sendEmail(
              {
                to: lead.submission.email,
                fromName: template.senderName || "Vercel",
                fromEmail: template.senderEmail || config.sdr.email,
                subject: template.subject.replace('{firstName}', firstName),
                html: fullEmail,
              },
              testModeEmail
            );

            // Internal notification would go to account rep from CRM
            // For now, just log it
            console.log(`Duplicate lead ${id} - would notify account rep`);
          }
          // irrelevant leads don't get emails
        }

        await adminDb.collection("leads").doc(id).update({
          "status.status": "done",
          "status.sent_at": now,
          "status.sent_by": "Ryan",
        });

        // Log approval event
        const timeToApprovalMs = now.getTime() - (lead.status.received_at as Date).getTime();
        await logEmailApprovalEvent(lead, timeToApprovalMs);

        // Also log forwarding if it's a support/duplicate lead
        if (currentClassification === "support") {
          await logLeadForwardedEvent(lead, "support", "system");
        } else if (currentClassification === "duplicate") {
          await logLeadForwardedEvent(lead, "account_team", "system");
        }

        break;
      }

      case "edit": {
        // Edit: Add new version to human_edits
        if (!email_text) {
          return NextResponse.json(
            {
              success: false,
              error: "email_text is required for edit action",
            },
            { status: 400 }
          );
        }

        const now = new Date();
        const newVersion = {
          text: email_text,
          timestamp: now,
        };

        // Get original text for analytics
        const originalText = lead.human_edits?.versions?.[0]?.text
          || lead.bot_text?.highQualityText
          || lead.bot_text?.lowQualityText
          || "";

        // Update human_edits
        if (lead.human_edits) {
          // Add to existing versions array
          await adminDb.collection("leads").doc(id).update({
            "human_edits.versions": FieldValue.arrayUnion(newVersion),
            "human_edits.note": edit_note || lead.human_edits.note,
          });
        } else {
          // Create new human_edits object
          await adminDb.collection("leads").doc(id).update({
            human_edits: {
              note: edit_note || null,
              versions: [newVersion],
            },
          });
        }

        // Log edit event
        await logEmailEditEvent(
          lead,
          "Original",
          originalText,
          "Edited",
          email_text
        );

        break;
      }

      case "reclassify": {
        // Reclassify: Add new classification entry to front of array
        if (!new_classification) {
          return NextResponse.json(
            {
              success: false,
              error: "new_classification is required for reclassify action",
            },
            { status: 400 }
          );
        }

        const now = new Date();
        const oldClassification = lead.classifications[0]?.classification;

        // Create new classification entry
        const newClassificationEntry: ClassificationEntry = {
          author: "human",
          classification: new_classification as Classification,
          timestamp: now,
        };

        // Determine post-reclassification behavior based on new classification
        const updateData: Record<string, unknown> = {};

        // For support, duplicate, irrelevant, low-quality: auto-send/forward immediately
        if (new_classification === "support") {
          updateData["status.status"] = "done";
          updateData["status.sent_at"] = now;
          updateData["status.sent_by"] = "Ryan";
        } else if (new_classification === "duplicate") {
          updateData["status.status"] = "done";
          updateData["status.sent_at"] = now;
          updateData["status.sent_by"] = "Ryan";
        } else if (new_classification === "irrelevant") {
          updateData["status.status"] = "done";
          updateData["status.sent_at"] = now;
          updateData["status.sent_by"] = "Ryan";
        } else if (new_classification === "low-quality") {
          // Low-quality leads use static template and auto-send
          updateData["status.status"] = "done";
          updateData["status.sent_at"] = now;
          updateData["status.sent_by"] = "Ryan";
        } else if (new_classification === "high-quality") {
          // High-quality leads need personalized email generated
          // Generate the email now since it wasn't generated during initial workflow
          try {
            const classification = {
              classification: "high-quality" as Classification,
              confidence: 1.0, // Human reclassification = full confidence
              reasoning: "Reclassified by human reviewer",
            };
            const researchReport = lead.bot_research?.reasoning || "";
            const leadData = {
              name: lead.submission.leadName,
              email: lead.submission.email,
              company: lead.submission.company,
              message: lead.submission.message,
            };
            const email = await generateEmailForLead(leadData, researchReport, classification);
            updateData["bot_text.highQualityText"] = email.body;
          } catch (err) {
            console.error("Failed to generate high-quality email on reclassify:", err);
            // Continue without generating email - human can write it manually
          }
          // Stay in review for email approval
        }

        // Update classifications array (prepend new entry)
        const updatedClassifications = [newClassificationEntry, ...lead.classifications];
        updateData.classifications = updatedClassifications;

        await adminDb.collection("leads").doc(id).update(updateData);

        // Log reclassification event
        if (oldClassification) {
          await logReclassificationEvent(lead, oldClassification, new_classification);
        }

        // Log forwarding events for auto-forwarded classifications
        if (new_classification === "support") {
          await logLeadForwardedEvent(lead, "support", "system");
        } else if (new_classification === "duplicate") {
          await logLeadForwardedEvent(lead, "account_team", "system");
        }

        // Send email for low-quality reclassification
        if (new_classification === "low-quality") {
          const config = await getConfiguration();
          if (config.email.enabled) {
            const template = config.emailTemplates.lowQuality;
            const testModeEmail = config.email.testMode ? config.email.testEmail : null;

            await sendEmail(
              {
                to: lead.submission.email,
                fromName: template.senderName,
                fromEmail: template.senderEmail,
                subject: template.subject,
                html: template.body,
              },
              testModeEmail
            );
          }
        }

        break;
      }

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

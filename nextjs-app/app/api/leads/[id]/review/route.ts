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
import { extractFirstName, assembleEmail, getBaseUrl, renderCaseStudiesHtml, caseStudyToMatchedCaseStudy } from "@/lib/email-helpers";
import { generateEmailForLead } from "@/lib/workflow-services";
import { getCaseStudyByIdServer } from "@/lib/firestore-server";

// Validation schema for review actions
const reviewActionSchema = z.object({
  action: z.enum(["approve", "edit", "reclassify"]),
  // For edit action
  email_text: z.string().optional(),
  edit_note: z.string().optional(),
  // For reclassify action
  new_classification: z.enum(["high-quality", "low-quality", "support", "duplicate"]).optional(),
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
        // Approve: Send email first, then set status to done only if successful
        const now = new Date();
        const config = await getConfiguration();
        const currentClassification = lead.classifications[0]?.classification;

        // Send email if enabled and classification requires it
        let emailSent = false;
        let sentEmailContent: { subject: string; html: string } | null = null;
        if (config.email.enabled && currentClassification) {
          const firstName = extractFirstName(lead.submission.leadName);
          const testModeEmail = config.email.testMode ? config.email.testEmail : null;

          // Determine which email to send based on classification
          if (currentClassification === "high-quality") {
            // Get the email text (without case studies - they're appended at send time)
            const emailText = lead.email?.text;

            if (emailText) {
              const senderName = config.sdr.name;
              const senderEmail = config.sdr.email;
              const emailSubject = config.emailTemplates.highQuality.subject.replace('{firstName}', firstName);

              // Append case studies at send time (only if experimental feature is enabled)
              let fullEmail = emailText;
              if (config.experimental?.caseStudies && lead.matched_case_studies && lead.matched_case_studies.length > 0) {
                fullEmail += renderCaseStudiesHtml(lead.matched_case_studies);
              }

              // Send the email
              const emailResult = await sendEmail(
                {
                  to: lead.submission.email,
                  fromName: senderName,
                  fromEmail: senderEmail,
                  subject: emailSubject,
                  html: fullEmail,
                },
                testModeEmail
              );

              emailSent = emailResult.success;
              if (emailResult.success) {
                sentEmailContent = { subject: emailSubject, html: fullEmail };
              } else {
                console.error(`Failed to send high-quality email for lead ${id}:`, emailResult.error);
              }
            }
          } else if (currentClassification === "low-quality") {
            // Low-quality uses static HTML template with firstName and optional case study
            const template = config.emailTemplates.lowQuality;

            // Fill in {firstName} placeholder
            let emailBody = template.body.replace(/{firstName}/g, firstName);

            // Add default case study if configured and experimental feature is enabled
            if (config.experimental?.caseStudies && config.defaultCaseStudyId) {
              const defaultCaseStudy = await getCaseStudyByIdServer(config.defaultCaseStudyId);
              if (defaultCaseStudy) {
                const matchedCaseStudy = caseStudyToMatchedCaseStudy(defaultCaseStudy);
                emailBody += renderCaseStudiesHtml([matchedCaseStudy]);
              }
            }

            const emailResult = await sendEmail(
              {
                to: lead.submission.email,
                fromName: template.senderName,
                fromEmail: template.senderEmail,
                subject: template.subject,
                html: emailBody,
              },
              testModeEmail
            );

            emailSent = emailResult.success;
            if (emailResult.success) {
              sentEmailContent = { subject: template.subject, html: emailBody };
            } else {
              console.error(`Failed to send low-quality email for lead ${id}:`, emailResult.error);
            }
          } else if (currentClassification === "support") {
            // Send acknowledgment to lead using configured HTML template
            const template = config.emailTemplates.support;
            const senderName = config.supportTeam.name;
            const senderEmail = config.supportTeam.email;
            const greeting = template.greeting.replace('{firstName}', firstName);
            const emailBody = `${greeting}${template.body
              .replace(/{baseUrl}/g, getBaseUrl())
              .replace(/{leadId}/g, lead.id)
              .replace(/{company}/g, lead.submission.company)}`;
            const emailSubject = template.subject.replace('{firstName}', firstName);

            const emailResult = await sendEmail(
              {
                to: lead.submission.email,
                fromName: senderName,
                fromEmail: senderEmail,
                subject: emailSubject,
                html: emailBody,
              },
              testModeEmail
            );

            emailSent = emailResult.success;

            if (emailResult.success) {
              sentEmailContent = { subject: emailSubject, html: emailBody };
              // Also send internal notification to support team (HTML template)
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
                  html: internalBody,
                },
                testModeEmail
              );
            } else {
              console.error(`Failed to send support email for lead ${id}:`, emailResult.error);
            }
          } else if (currentClassification === "duplicate") {
            // Send acknowledgment to lead using configured HTML template
            const template = config.emailTemplates.duplicate;
            const senderName = config.sdr.name;
            const senderEmail = config.sdr.email;
            const greeting = template.greeting.replace('{firstName}', firstName);
            const emailBody = `${greeting}${template.body
              .replace(/{baseUrl}/g, getBaseUrl())
              .replace(/{leadId}/g, lead.id)
              .replace(/{company}/g, lead.submission.company)}`;
            const emailSubject = template.subject.replace('{firstName}', firstName);

            const emailResult = await sendEmail(
              {
                to: lead.submission.email,
                fromName: senderName,
                fromEmail: senderEmail,
                subject: emailSubject,
                html: emailBody,
              },
              testModeEmail
            );

            emailSent = emailResult.success;
            if (emailResult.success) {
              sentEmailContent = { subject: emailSubject, html: emailBody };
            } else {
              console.error(`Failed to send duplicate email for lead ${id}:`, emailResult.error);
            }
          }
        }

        // Only mark as done if email was sent successfully (or email is disabled)
        if (emailSent || !config.email.enabled) {
          const updateData: Record<string, unknown> = {
            "status.status": "done",
            "status.sent_at": now,
            "status.sent_by": "Ryan",
          };
          // Store the sent email content for display on success page
          if (sentEmailContent) {
            updateData.sent_email = sentEmailContent;
          }
          await adminDb.collection("leads").doc(id).update(updateData);

          // Log approval event (received_at may be Firestore Timestamp or Date)
          const receivedAtRaw = lead.status.received_at as any;
          const receivedAt = receivedAtRaw?.toDate?.() ?? receivedAtRaw;
          const timeToApprovalMs = now.getTime() - (receivedAt as Date).getTime();
          await logEmailApprovalEvent(lead, timeToApprovalMs);

          // Also log forwarding if it's a support/duplicate lead
          if (currentClassification === "support") {
            await logLeadForwardedEvent(lead, "support", "system");
          } else if (currentClassification === "duplicate") {
            await logLeadForwardedEvent(lead, "account_team", "system");
          }
        } else {
          // Email failed - return error to user
          return NextResponse.json(
            {
              success: false,
              error: "Failed to send email. Please try again.",
            },
            { status: 500 }
          );
        }

        break;
      }

      case "edit": {
        // Edit: Update the email text
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

        // Get original text for analytics
        const originalText = lead.email?.text || "";

        // Update email with the edited text
        await adminDb.collection("leads").doc(id).update({
          "email.text": email_text,
          "email.editedAt": now,
          "email.lastEditedBy": "human",  // TODO: Get actual user name when auth is added
          "edit_note": edit_note || lead.edit_note || null,
        });

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

        // Update classifications array (prepend new entry)
        const updatedClassifications = [newClassificationEntry, ...lead.classifications];
        const updateData: Record<string, unknown> = {
          classifications: updatedClassifications,
        };

        // For high-quality: generate email and stay in review
        if (new_classification === "high-quality") {
          try {
            const classification = {
              classification: "high-quality" as Classification,
              confidence: 1.0, // Human reclassification = full confidence
              reasoning: "Reclassified by human reviewer",
              existingCustomer: lead.bot_research?.existingCustomer ?? false,
            };
            const researchReport = lead.bot_research?.reasoning || "";
            const leadData = {
              name: lead.submission.leadName,
              email: lead.submission.email,
              company: lead.submission.company,
              message: lead.submission.message,
            };
            const emailGenerated = await generateEmailForLead(leadData);
            const now = new Date();

            // Assemble the full email (greeting + body + CTA + signoff + signature)
            // Note: Case studies are NOT included - they're appended at send time
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
              lead.id
              // Case studies omitted - appended at send time
            );

            updateData["email.text"] = fullEmail;
            updateData["email.createdAt"] = now;
            updateData["email.editedAt"] = now;
          } catch (err) {
            console.error("Failed to generate high-quality email on reclassify:", err);
            // Continue without generating email - human can write it manually
          }
          // Update classification only, stay in review for email approval
          await adminDb.collection("leads").doc(id).update(updateData);
        } else {
          // For support, duplicate, low-quality: send email first, then update status
          const config = await getConfiguration();
          const firstName = extractFirstName(lead.submission.leadName);
          const testModeEmail = config.email.testMode ? config.email.testEmail : null;

          let emailSent = false;
          let reclassSentEmailContent: { subject: string; html: string } | null = null;

          if (config.email.enabled) {
            if (new_classification === "low-quality") {
              const template = config.emailTemplates.lowQuality;

              // Fill in {firstName} placeholder
              let emailBody = template.body.replace(/{firstName}/g, firstName);

              // Add default case study if configured and experimental feature is enabled
              if (config.experimental?.caseStudies && config.defaultCaseStudyId) {
                const defaultCaseStudy = await getCaseStudyByIdServer(config.defaultCaseStudyId);
                if (defaultCaseStudy) {
                  const matchedCaseStudy = caseStudyToMatchedCaseStudy(defaultCaseStudy);
                  emailBody += renderCaseStudiesHtml([matchedCaseStudy]);
                }
              }

              const result = await sendEmail(
                {
                  to: lead.submission.email,
                  fromName: template.senderName,
                  fromEmail: template.senderEmail,
                  subject: template.subject,
                  html: emailBody,
                },
                testModeEmail
              );
              emailSent = result.success;
              if (result.success) {
                reclassSentEmailContent = { subject: template.subject, html: emailBody };
              } else {
                console.error(`Failed to send low-quality email for lead ${id}:`, result.error);
              }
            } else if (new_classification === "support") {
              // Send acknowledgment with reroute link
              const template = config.emailTemplates.support;
              const senderName = config.supportTeam.name;
              const senderEmail = config.supportTeam.email;
              const greeting = template.greeting.replace('{firstName}', firstName);
              const emailBody = `${greeting}${template.body
                .replace(/{baseUrl}/g, getBaseUrl())
                .replace(/{leadId}/g, lead.id)
                .replace(/{company}/g, lead.submission.company)}`;
              const emailSubject = template.subject.replace('{firstName}', firstName);

              const result = await sendEmail(
                {
                  to: lead.submission.email,
                  fromName: senderName,
                  fromEmail: senderEmail,
                  subject: emailSubject,
                  html: emailBody,
                },
                testModeEmail
              );
              emailSent = result.success;

              if (result.success) {
                reclassSentEmailContent = { subject: emailSubject, html: emailBody };
                // Also send internal notification
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
                    html: internalBody,
                  },
                  testModeEmail
                );
              } else {
                console.error(`Failed to send support email for lead ${id}:`, result.error);
              }
            } else if (new_classification === "duplicate") {
              // Send acknowledgment with reroute link
              const template = config.emailTemplates.duplicate;
              const senderName = config.sdr.name;
              const senderEmail = config.sdr.email;
              const greeting = template.greeting.replace('{firstName}', firstName);
              const emailBody = `${greeting}${template.body
                .replace(/{baseUrl}/g, getBaseUrl())
                .replace(/{leadId}/g, lead.id)
                .replace(/{company}/g, lead.submission.company)}`;
              const emailSubject = template.subject.replace('{firstName}', firstName);

              const result = await sendEmail(
                {
                  to: lead.submission.email,
                  fromName: senderName,
                  fromEmail: senderEmail,
                  subject: emailSubject,
                  html: emailBody,
                },
                testModeEmail
              );
              emailSent = result.success;
              if (result.success) {
                reclassSentEmailContent = { subject: emailSubject, html: emailBody };
              } else {
                console.error(`Failed to send duplicate email for lead ${id}:`, result.error);
              }
            }
          }

          // Only mark as done if email was sent successfully (or email is disabled)
          if (emailSent || !config.email.enabled) {
            updateData["status.status"] = "done";
            updateData["status.sent_at"] = now;
            updateData["status.sent_by"] = "Ryan";
            // Store the sent email content for display on success page
            if (reclassSentEmailContent) {
              updateData.sent_email = reclassSentEmailContent;
            }

            // Log forwarding events for auto-forwarded classifications
            if (new_classification === "support") {
              await logLeadForwardedEvent(lead, "support", "system");
            } else if (new_classification === "duplicate") {
              await logLeadForwardedEvent(lead, "account_team", "system");
            }
          }

          await adminDb.collection("leads").doc(id).update(updateData);
        }

        // Log reclassification event
        if (oldClassification) {
          await logReclassificationEvent(lead, oldClassification, new_classification);
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

/**
 * Classification-specific email sending functions
 *
 * These functions encapsulate the email sending logic for each classification type,
 * eliminating duplication across API routes.
 */

import type { Lead, Configuration, MatchedCaseStudy } from '../types';
import type { SendEmailResult } from './send';
import { sendEmail } from './send';
import { extractFirstName, getBaseUrl, renderCaseStudiesHtml, caseStudyToMatchedCaseStudy } from './helpers';
import { getCaseStudyByIdServer } from '../db';

/**
 * Result from classification email sending
 */
export interface ClassificationEmailResult {
  success: boolean;
  sentContent: { subject: string; html: string } | null;
  error?: string;
}

/**
 * Common parameters for classification email functions
 */
interface EmailParams {
  lead: Lead;
  config: Configuration;
  testModeEmail?: string | null;
}

/**
 * Send low-quality lead email (generic sales email)
 *
 * Uses static HTML template with {firstName} placeholder.
 * Optionally appends default case study if configured.
 */
export async function sendLowQualityEmail(
  params: EmailParams
): Promise<ClassificationEmailResult> {
  const { lead, config, testModeEmail } = params;

  if (!config.email.enabled) {
    return { success: true, sentContent: null };
  }

  const template = config.emailTemplates.lowQuality;
  const firstName = extractFirstName(lead.submission.leadName);

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

  if (result.success) {
    return {
      success: true,
      sentContent: { subject: template.subject, html: emailBody },
    };
  }

  console.error(`Failed to send low-quality email for lead ${lead.id}:`, result.error);
  return {
    success: false,
    sentContent: null,
    error: result.error,
  };
}

/**
 * Send support acknowledgment email to lead and internal notification to support team
 *
 * Uses configured HTML templates with placeholders:
 * - {firstName}, {baseUrl}, {leadId}, {company} for customer email
 * - {firstName}, {company}, {email}, {message} for internal notification
 */
export async function sendSupportEmail(
  params: EmailParams
): Promise<ClassificationEmailResult> {
  const { lead, config, testModeEmail } = params;

  if (!config.email.enabled) {
    return { success: true, sentContent: null };
  }

  const template = config.emailTemplates.support;
  const firstName = extractFirstName(lead.submission.leadName);
  const senderName = config.supportTeam.name;
  const senderEmail = config.supportTeam.email;

  // Build customer acknowledgment email
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

  if (!result.success) {
    console.error(`Failed to send support email for lead ${lead.id}:`, result.error);
    return {
      success: false,
      sentContent: null,
      error: result.error,
    };
  }

  // Send internal notification to support team
  const internalTemplate = config.emailTemplates.supportInternal;
  const internalBody = internalTemplate.body
    .replace('{firstName}', firstName)
    .replace('{company}', lead.submission.company)
    .replace('{email}', lead.submission.email)
    .replace('{message}', lead.submission.message);

  await sendEmail(
    {
      to: config.supportTeam.email,
      fromName: config.sdr.name,
      fromEmail: config.sdr.email,
      subject: internalTemplate.subject
        .replace('{firstName}', firstName)
        .replace('{company}', lead.submission.company),
      html: internalBody,
    },
    testModeEmail
  );

  return {
    success: true,
    sentContent: { subject: emailSubject, html: emailBody },
  };
}

/**
 * Send duplicate acknowledgment email to lead
 *
 * Uses configured HTML template with placeholders:
 * - {firstName}, {baseUrl}, {leadId}, {company}
 */
export async function sendDuplicateEmail(
  params: EmailParams
): Promise<ClassificationEmailResult> {
  const { lead, config, testModeEmail } = params;

  if (!config.email.enabled) {
    return { success: true, sentContent: null };
  }

  const template = config.emailTemplates.duplicate;
  const firstName = extractFirstName(lead.submission.leadName);
  const senderName = config.sdr.name;
  const senderEmail = config.sdr.email;

  // Build acknowledgment email
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

  if (result.success) {
    return {
      success: true,
      sentContent: { subject: emailSubject, html: emailBody },
    };
  }

  console.error(`Failed to send duplicate email for lead ${lead.id}:`, result.error);
  return {
    success: false,
    sentContent: null,
    error: result.error,
  };
}

/**
 * Send high-quality lead email (personalized meeting offer)
 *
 * Uses the pre-assembled email text from lead.email.text,
 * optionally appending matched case studies at send time.
 */
export async function sendHighQualityEmail(
  params: EmailParams & { matchedCaseStudies?: MatchedCaseStudy[] }
): Promise<ClassificationEmailResult> {
  const { lead, config, testModeEmail, matchedCaseStudies } = params;

  if (!config.email.enabled) {
    return { success: true, sentContent: null };
  }

  const emailText = lead.email?.text;
  if (!emailText) {
    return {
      success: false,
      sentContent: null,
      error: 'No email text available for high-quality lead',
    };
  }

  const firstName = extractFirstName(lead.submission.leadName);
  const senderName = config.sdr.name;
  const senderEmail = config.sdr.email;
  const emailSubject = config.emailTemplates.highQuality.subject.replace('{firstName}', firstName);

  // Append case studies at send time if experimental feature is enabled
  let fullEmail = emailText;
  if (config.experimental?.caseStudies && matchedCaseStudies && matchedCaseStudies.length > 0) {
    fullEmail += renderCaseStudiesHtml(matchedCaseStudies);
  }

  const result = await sendEmail(
    {
      to: lead.submission.email,
      fromName: senderName,
      fromEmail: senderEmail,
      subject: emailSubject,
      html: fullEmail,
    },
    testModeEmail
  );

  if (result.success) {
    return {
      success: true,
      sentContent: { subject: emailSubject, html: fullEmail },
    };
  }

  console.error(`Failed to send high-quality email for lead ${lead.id}:`, result.error);
  return {
    success: false,
    sentContent: null,
    error: result.error,
  };
}

/**
 * Email template helper functions
 *
 * All email content is now stored as HTML for consistency:
 * - Templates store HTML directly
 * - AI-generated content is wrapped in HTML at generation time
 * - Human edits are stored as HTML from the rich text editor
 */

import { MatchedCaseStudy } from './types';
import type { CaseStudy } from './case-studies';

/**
 * Get the base URL for email links from environment variable
 * Falls back to window.location.origin on client, or localhost/production URL on server
 */
export function getBaseUrl(): string {
  // Check environment variable first (works on both client and server)
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  // On client, use current origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  // Server-side fallback
  return process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : 'https://inbound-ten.vercel.app';
}

/**
 * Fill template with variables
 * Supported variables: {firstName}, {company}, {sdrName}, {baseUrl}
 */
export function fillTemplate(
  template: string,
  vars: {
    firstName: string;
    company: string;
    sdrName: string;
  }
): string {
  return template
    .replace(/{firstName}/g, vars.firstName)
    .replace(/{company}/g, vars.company)
    .replace(/{sdrName}/g, vars.sdrName)
    .replace(/{baseUrl}/g, getBaseUrl());
}

/**
 * Extract first name from full name
 */
export function extractFirstName(fullName: string): string {
  return fullName.split(' ')[0];
}

/**
 * Email template parts for assembly
 */
export interface EmailTemplateParts {
  greeting: string;
  callToAction: string;
  signOff: string;
  senderName: string;
  senderLastName: string;
  senderEmail: string;
  senderTitle: string;
}

/**
 * Render case studies as HTML for email footer
 * Vercel customers page style: large logo, featured text, "Read the full story" link
 */
export function renderCaseStudiesHtml(caseStudies: MatchedCaseStudy[]): string {
  if (!caseStudies || caseStudies.length === 0) {
    return '';
  }

  const caseStudyCards = caseStudies.map(cs => {
    // Logo HTML (larger, at top) - uses data URI for SVG
    const logoHtml = cs.logoSvg
      ? `<img src="data:image/svg+xml;base64,${Buffer.from(cs.logoSvg).toString('base64')}" alt="${cs.company}" style="height: 32px; max-width: 140px; object-fit: contain; display: block; margin-bottom: 16px;" />`
      : `<p style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #888;">${cs.company}</p>`;

    // Featured text (gray, full width)
    const featuredTextHtml = cs.featuredText
      ? `<p style="margin: 0 0 16px 0; color: #888; font-size: 15px; line-height: 1.6;">${cs.featuredText}</p>`
      : '';

    // Read the full story link with arrow
    const linkHtml = `<a href="${cs.url}" style="color: #888; text-decoration: none; font-size: 14px;">Read the full story <span style="margin-left: 4px;">→</span></a>`;

    return `<div style="border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
  ${logoHtml}
  ${featuredTextHtml}
  ${linkHtml}
</div>`;
  }).join('\n');

  return `
<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">
<div style="font-size: 14px;">
${caseStudyCards}
</div>`;
}

/**
 * Assemble full email as HTML from template parts and body content
 *
 * All parts are now stored as HTML:
 * - bodyContent: HTML from AI generation or human edits
 * - template parts: HTML stored in configuration
 *
 * @param bodyContent - The middle section of the email (HTML)
 * @param template - The template parts (greeting, CTA, sign-off) - all HTML
 * @param firstName - Lead's first name to fill in greeting
 * @param leadId - Optional lead ID for placeholders in CTA (e.g., meeting links)
 * @param caseStudies - Optional case studies to display at end of email (high-quality only)
 * @returns The fully assembled email as HTML
 */
export function assembleEmail(
  bodyContent: string,
  template: EmailTemplateParts,
  firstName: string,
  leadId?: string,
  caseStudies?: MatchedCaseStudy[]
): string {
  // Fill in greeting with first name and SDR name
  const greeting = template.greeting
    .replace('{firstName}', firstName)
    .replace('{sdrName}', template.senderName);

  // Fill in CTA with lead ID and base URL if needed (CTA is HTML)
  let callToAction = template.callToAction
    .replace(/{baseUrl}/g, getBaseUrl());
  if (leadId) {
    callToAction = callToAction.replace(/{leadId}/g, leadId);
  }

  // Fill in sign-off (HTML)
  const signOff = template.signOff;

  // Render case studies section (for high-quality emails)
  const caseStudiesHtml = caseStudies ? renderCaseStudiesHtml(caseStudies) : '';

  // Assemble all HTML parts
  // Signature format: Best, + first name (no gap), then blank line, then full name + title
  return `${greeting}
${bodyContent}
${callToAction}
<p>Best,<br>${template.senderName}</p>
<p>${template.senderName} ${template.senderLastName}<br>▲ Vercel ${template.senderTitle}</p>${caseStudiesHtml}`;
}

/**
 * Get the email content from a lead
 *
 * With the simplified data model, email.text contains the fully assembled email
 * (greeting + body + CTA + signoff + signature + case studies)
 */
export function getEmailBody(lead: {
  email?: { text?: string } | null;
}): string | null {
  return lead.email?.text || null;
}

/**
 * Convert a CaseStudy to MatchedCaseStudy format for email rendering
 */
export function caseStudyToMatchedCaseStudy(caseStudy: CaseStudy, matchType: 'industry' | 'problem' | 'mentioned' = 'mentioned'): MatchedCaseStudy {
  return {
    caseStudyId: caseStudy.id,
    company: caseStudy.company,
    industry: caseStudy.industry,
    url: caseStudy.url,
    matchType,
    matchReason: 'Default case study',
    logoSvg: caseStudy.logoSvg,
    featuredText: caseStudy.featuredText,
  };
}

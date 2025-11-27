/**
 * Email template helper functions
 */

/**
 * Fill template with variables
 * Supported variables: {firstName}, {company}, {sdrName}
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
    .replace(/{sdrName}/g, vars.sdrName);
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
  senderEmail: string;
}

/**
 * Assemble full email as HTML from template parts and AI-generated body content
 *
 * @param bodyContent - The AI-generated middle section of the email (plain text)
 * @param template - The template parts (greeting, CTA, sign-off) - CTA should contain HTML links
 * @param firstName - Lead's first name to fill in greeting
 * @param leadId - Optional lead ID for placeholders in CTA (e.g., meeting links)
 * @returns The fully assembled email as HTML
 */
export function assembleEmail(
  bodyContent: string,
  template: EmailTemplateParts,
  firstName: string,
  leadId?: string
): string {
  // Fill in greeting with first name
  const greeting = template.greeting.replace('{firstName}', firstName);

  // Fill in CTA with lead ID if needed
  let callToAction = template.callToAction;
  if (leadId) {
    callToAction = callToAction.replace('{leadId}', leadId);
  }

  // Convert plain text body to HTML paragraphs
  // Split on double newlines for paragraphs, preserve single newlines as <br>
  const bodyHtml = bodyContent
    .split('\n\n')
    .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  // Assemble as HTML
  return `<p>${greeting}</p>
${bodyHtml}
<p>${callToAction}</p>
<p>${template.signOff}</p>
<p>${template.senderName}<br>${template.senderEmail}</p>`;
}

/**
 * Get just the AI-generated body from a lead's stored email content
 * This is for backwards compatibility with existing leads that have full emails stored
 *
 * For new leads, bot_text stores only the body content.
 * For display, we assemble the full email using current template settings.
 */
export function getEmailBody(lead: {
  bot_text?: { highQualityText?: string; lowQualityText?: string | null } | null;
  human_edits?: { versions: Array<{ text: string }> } | null;
}): string | null {
  // Human edits take precedence - these are always the full email for now
  // TODO: Once human_edits also stores only body, this can be simplified
  if (lead.human_edits?.versions[0]?.text) {
    return lead.human_edits.versions[0].text;
  }

  // Return AI-generated body (only highQualityText is AI-generated now)
  return lead.bot_text?.highQualityText || null;
}

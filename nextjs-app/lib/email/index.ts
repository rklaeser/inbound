// Email module - re-exports for convenient importing
// NOTE: Classification-specific email functions are server-only
// Import them directly from '@/lib/email/classification-emails'

// Send email via Resend
export type { SendEmailParams, SendEmailResult } from './send';
export { sendEmail } from './send';

// Default templates
export { DEFAULT_LOW_VALUE_TEMPLATE } from './templates';

// Helper functions
export type { EmailTemplateParts } from './helpers';
export {
  getBaseUrl,
  fillTemplate,
  extractFirstName,
  renderCaseStudiesHtml,
  assembleEmail,
  getEmailBody,
  caseStudyToMatchedCaseStudy,
} from './helpers';

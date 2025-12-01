import { Timestamp } from "firebase/firestore";
import { CLASSIFICATION_PROMPT, EMAIL_GENERATION_PROMPT } from "./prompts";

// =============================================================================
// ENUMS
// =============================================================================

// Classification types - what kind of lead is this?
export type Classification =
  | 'high-quality'      // Strong fit, gets personalized meeting offer email
  | 'low-quality'       // Not a fit or spam/nonsense, gets generic sales email
  | 'support'           // Existing customer needing help, forwarded to support
  | 'duplicate'         // Already a customer in CRM, forwarded to account team
  | 'customer-reroute'  // Customer disputed support/duplicate classification via escape hatch
  | 'internal-reroute'; // Internal team (support/account) disputed classification

// Status types - where is this lead in the workflow?
// classify: waiting for human to classify (AI classification rate check failed)
// review: AI classified, waiting for human to review/approve
// done: action taken (email sent or forwarded)
export type LeadStatus = 'classify' | 'review' | 'done';

// Terminal state - derived from status + classification when status = 'done'
export type TerminalState =
  | 'sent_meeting_offer'      // high-quality lead, personalized email sent
  | 'sent_generic'            // low-quality lead, generic sales email sent
  | 'forwarded_support'       // support lead, forwarded to support team
  | 'forwarded_account_team'  // duplicate lead, forwarded to account team
  | 'customer_reroute'        // customer disputed classification, needs SDR review
  | 'internal_reroute';       // internal team disputed classification, needs SDR review

// =============================================================================
// CLASSIFICATION CONFIG (single source of truth for display)
// =============================================================================

export interface ClassificationConfig {
  key: Classification;
  label: string;
  description: string;
  colors: {
    text: string;
    background: string;
    border: string;
  };
  action: {
    short: string;  // Badge text (e.g., "Reply with Meeting")
    long: string;   // Button text (e.g., "Reply with Meeting")
    color: string;  // Action-specific color (may differ from classification color)
  };
}

export const CLASSIFICATIONS: Record<Classification, ClassificationConfig> = {
  'high-quality': {
    key: 'high-quality',
    label: 'High Quality',
    description: 'High-value lead with clear product-market fit',
    colors: {
      text: '#22c55e',
      background: 'rgba(34, 197, 94, 0.1)',
      border: 'rgba(34, 197, 94, 0.2)',
    },
    action: {
      short: 'Reply with Meeting',
      long: 'Reply with Meeting',
      color: '#22c55e',
    },
  },
  'low-quality': {
    key: 'low-quality',
    label: 'Low Quality',
    description: 'Real opportunity but not a good fit for personalized outreach',
    colors: {
      text: '#a1a1a1',
      background: 'rgba(161, 161, 161, 0.1)',
      border: 'rgba(161, 161, 161, 0.2)',
    },
    action: {
      short: 'Reply with Generic',
      long: 'Reply with Generic',
      color: '#a1a1a1',
    },
  },
  support: {
    key: 'support',
    label: 'Support',
    description: 'Existing customer with support request',
    colors: {
      text: '#3b82f6',
      background: 'rgba(59, 130, 246, 0.1)',
      border: 'rgba(59, 130, 246, 0.2)',
    },
    action: {
      short: 'Forward Support',
      long: 'Forward to Support',
      color: '#3b82f6',
    },
  },
  duplicate: {
    key: 'duplicate',
    label: 'Duplicate',
    description: 'Duplicate submission from existing customer',
    colors: {
      text: '#a855f7',
      background: 'rgba(168, 85, 247, 0.1)',
      border: 'rgba(168, 85, 247, 0.2)',
    },
    action: {
      short: 'Forward Duplicate',
      long: 'Forward to Account Team',
      color: '#a855f7',
    },
  },
  'customer-reroute': {
    key: 'customer-reroute',
    label: 'Customer Reroute',
    description: 'Customer disputed support/duplicate classification',
    colors: {
      text: '#f59e0b',
      background: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.2)',
    },
    action: {
      short: 'Needs Review',
      long: 'Review Reroute Request',
      color: '#f59e0b',
    },
  },
  'internal-reroute': {
    key: 'internal-reroute',
    label: 'Internal Reroute',
    description: 'Internal team disputed classification',
    colors: {
      text: '#ec4899',
      background: 'rgba(236, 72, 153, 0.1)',
      border: 'rgba(236, 72, 153, 0.2)',
    },
    action: {
      short: 'Needs Review',
      long: 'Review Internal Reroute',
      color: '#ec4899',
    },
  },
};

// Classification helper functions
export function getClassificationConfig(c: Classification): ClassificationConfig {
  return CLASSIFICATIONS[c];
}

export function getClassificationLabel(c: Classification): string {
  return CLASSIFICATIONS[c].label;
}

export function getClassificationColors(c: Classification) {
  return CLASSIFICATIONS[c].colors;
}

export function getClassificationAction(c: Classification) {
  return CLASSIFICATIONS[c].action;
}

export const ALL_CLASSIFICATIONS = Object.values(CLASSIFICATIONS);

// =============================================================================
// TERMINAL STATE CONFIG (single source of truth for display)
// =============================================================================

export interface TerminalStateConfig {
  key: TerminalState;
  label: string;
  colors: {
    text: string;
    background: string;
    border: string;
  };
}

export const TERMINAL_STATES: Record<TerminalState, TerminalStateConfig> = {
  sent_meeting_offer: {
    key: 'sent_meeting_offer',
    label: 'Meeting Offer Sent',
    colors: {
      text: '#22c55e',
      background: 'rgba(34, 197, 94, 0.1)',
      border: 'rgba(34, 197, 94, 0.2)',
    },
  },
  sent_generic: {
    key: 'sent_generic',
    label: 'Generic Message Sent',
    colors: {
      text: '#a1a1a1',
      background: 'rgba(161, 161, 161, 0.1)',
      border: 'rgba(161, 161, 161, 0.2)',
    },
  },
  forwarded_support: {
    key: 'forwarded_support',
    label: 'Forwarded to Support',
    colors: {
      text: '#3b82f6',
      background: 'rgba(59, 130, 246, 0.1)',
      border: 'rgba(59, 130, 246, 0.2)',
    },
  },
  forwarded_account_team: {
    key: 'forwarded_account_team',
    label: 'Forwarded to Account Team',
    colors: {
      text: '#a855f7',
      background: 'rgba(168, 85, 247, 0.1)',
      border: 'rgba(168, 85, 247, 0.2)',
    },
  },
  customer_reroute: {
    key: 'customer_reroute',
    label: 'Customer Reroute',
    colors: {
      text: '#f59e0b',
      background: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.2)',
    },
  },
  internal_reroute: {
    key: 'internal_reroute',
    label: 'Internal Reroute',
    colors: {
      text: '#ec4899',
      background: 'rgba(236, 72, 153, 0.1)',
      border: 'rgba(236, 72, 153, 0.2)',
    },
  },
};

// Terminal state helper functions
export function getTerminalStateConfig(s: TerminalState): TerminalStateConfig {
  return TERMINAL_STATES[s];
}

export function getTerminalStateLabel(s: TerminalState): string {
  return TERMINAL_STATES[s].label;
}

export function getTerminalStateColors(s: TerminalState) {
  return TERMINAL_STATES[s].colors;
}

// =============================================================================
// MATCHED CASE STUDIES (for customer success page)
// =============================================================================

export interface MatchedCaseStudy {
  caseStudyId: string;
  company: string;
  industry: string;
  url: string;
  matchType: 'industry' | 'problem' | 'mentioned';
  matchReason: string;
  // Display data
  logoSvg?: string;       // Raw SVG markup stored in Firestore
  featuredText?: string;  // Featured text from Vercel's customer page
}

// =============================================================================
// LEAD DATA MODEL
// =============================================================================

// Submission data - what the user submitted via the form
export interface Submission {
  leadName: string;
  email: string;
  message: string;
  company: string;
}

// Bot research output - AI analysis of the lead
export interface BotResearch {
  timestamp: Date | Timestamp;
  confidence: number;  // 0-1
  classification: Classification;
  reasoning: string;
  existingCustomer: boolean;  // True if CRM lookup found existing customer relationship
  crmRecordId?: string;  // CRM record ID if existing customer found
  researchReport?: string;  // Full research report from ExaAI (optional for backwards compatibility)
}

// Bot rollout decision
export interface BotRollout {
  rollOut: number;  // 0-1 percentage chance of auto-send
  useBot: boolean;
}

// Email content - single source of truth for email text
export interface Email {
  text: string;                    // Current email text (bot-generated initially, can be edited)
  createdAt: Date | Timestamp;     // When bot first created it
  editedAt: Date | Timestamp;      // When last edited (same as createdAt initially)
  lastEditedBy?: string;           // SDR name who edited (undefined if bot-only)
}

// Lead status information
export interface StatusInfo {
  status: LeadStatus;
  received_at: Date | Timestamp;
  sent_at: Date | Timestamp | null;
  sent_by: string | null;  // "bot" for AI, "system" for deterministic rules, or user name like "Ryan"
}

// Classification entry (bot or human)
export interface ClassificationEntry {
  author: 'human' | 'bot';
  classification: Classification;
  timestamp: Date | Timestamp;
  needs_review?: boolean;       // Only for bot: confidence < applied_threshold
  applied_threshold?: number;   // Only for bot: threshold from settings at processing time
}

// Main Lead interface
export interface Lead {
  id: string;

  // Submission data
  submission: Submission;

  // Bot outputs (null until processed)
  bot_research: BotResearch | null;
  bot_rollout: BotRollout | null;

  // Email content (null until generated by workflow)
  email: Email | null;

  // Edit note for context (reroute reasons, etc.)
  edit_note?: string | null;

  // Status
  status: StatusInfo;

  // Classification history (newest first)
  // When human reclassifies, new entry is added to front
  classifications: ClassificationEntry[];

  // Test metadata (optional - only present for test leads)
  metadata?: {
    isTestLead: boolean;
    testCase: string;
    expectedClassifications: readonly Classification[];
  };

  // Matched case studies from workflow research (optional - populated after research step)
  matched_case_studies?: MatchedCaseStudy[];

  // Support team feedback (optional - set when support marks lead as self-service)
  supportFeedback?: {
    markedSelfService: boolean;
    timestamp: Date;
  };

  // Sent email content (optional - populated when email is sent, for display on success page)
  sent_email?: {
    subject: string;
    html: string;
  };
}

// =============================================================================
// DERIVED STATE FUNCTIONS
// =============================================================================

// Derive terminal state from status + current classification
export function getTerminalState(lead: Lead): TerminalState | null {
  if (!lead.status || lead.status.status !== 'done') return null;
  if (!lead.classifications || lead.classifications.length === 0) return null;

  const classification = lead.classifications[0].classification;

  switch (classification) {
    case 'high-quality': return 'sent_meeting_offer';
    case 'low-quality': return 'sent_generic';
    case 'support': return 'forwarded_support';
    case 'duplicate': return 'forwarded_account_team';
    case 'customer-reroute': return 'customer_reroute';
    case 'internal-reroute': return 'internal_reroute';
  }
}

// Get current classification (most recent)
export function getCurrentClassification(lead: Lead): Classification | null {
  return (lead.classifications && lead.classifications.length > 0) ? lead.classifications[0].classification : null;
}

// Check if lead was reclassified by human
export function wasReclassified(lead: Lead): boolean {
  return lead.classifications.length > 1;
}

// Check if lead needs human review
export function needsReview(lead: Lead): boolean {
  return lead.status.status === 'review';
}

// =============================================================================
// FILTER OPTIONS (for AllLeads UI filtering)
// =============================================================================

export interface FilterOption {
  key: string;
  label: string;
  color: string;
}

// Status filter options (matches lead.status.status)
export const STATUS_FILTER_OPTIONS: FilterOption[] = [
  { key: 'classify', label: 'Classify', color: '#eab308' },  // yellow-500
  { key: 'review', label: 'Review', color: '#f97316' },      // orange-500
  { key: 'done', label: 'Done', color: '#22c55e' },          // green-500
];

// Type filter options (matches classification)
export const TYPE_FILTER_OPTIONS: FilterOption[] = [
  { key: 'high-quality', label: 'High Quality', color: '#22c55e' },        // green-500
  { key: 'low-quality', label: 'Low Quality', color: '#a1a1a1' },          // gray
  { key: 'support', label: 'Support', color: '#3b82f6' },                  // blue-500
  { key: 'duplicate', label: 'Duplicate', color: '#a855f7' },              // purple-500
  { key: 'customer-reroute', label: 'Customer Reroute', color: '#f59e0b' }, // amber-500
  { key: 'internal-reroute', label: 'Internal Reroute', color: '#ec4899' }, // pink-500
  { key: 'unclassified', label: 'Unclassified', color: '#f97316' },        // orange-500
];

// Legacy helper for compatibility (use getTerminalStateLabel instead)
export function getTerminalStateDisplay(state: TerminalState): { label: string; color: string } {
  const config = TERMINAL_STATES[state];
  return { label: config.label, color: config.colors.text };
}

// Legacy helper for compatibility (use getClassificationLabel instead)
export function getClassificationDisplay(classification: Classification): { label: string; color: string } {
  const config = CLASSIFICATIONS[classification];
  return { label: config.label, color: config.colors.text };
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface Configuration {
  thresholds: {
    highQuality: number;    // Default 0.98 - auto-send meeting offer (only if allowHighQualityAutoSend is true)
    lowQuality: number;     // Default 0.51 - auto-send generic email
    support: number;        // Default 0.9 - auto-forward to support
    // Note: duplicate threshold removed - duplicates always auto-forward via deterministic CRM check
  };

  // High-quality leads require human review by default since they offer meetings
  // Set to true to allow auto-sending when confidence >= highQuality threshold
  allowHighQualityAutoSend: boolean;

  sdr: {
    name: string;
    lastName: string;
    email: string;
    title: string;    // Job title, e.g., "Development Representative"
    avatar?: string;  // URL to SDR's profile picture
  };

  // Forwarding destination for support requests
  supportTeam: {
    name: string;
    email: string;
  };

  emailTemplates: {
    highQuality: {
      subject: string;
      greeting: string;
      callToAction: string;
      signOff: string;
    };
    lowQuality: {
      subject: string;
      body: string;
      senderName: string;
      senderEmail: string;
    };
    support: {
      subject: string;
      greeting: string;
      body: string;
    };
    duplicate: {
      subject: string;
      greeting: string;
      body: string;
    };
    // Internal notifications (sent to internal teams, not customers)
    supportInternal: {
      subject: string;
      body: string;
    };
    duplicateInternal: {
      subject: string;
      body: string;
    };
  };

  prompts: {
    classification: string;
    emailHighQuality: string;
  };

  rollout: {
    percentage: number;  // 0-1 (0 = disabled, 1 = 100% auto-send)
  };

  email: {
    enabled: boolean;           // Master switch for sending emails
    testMode: boolean;          // When true, all emails go to testEmail
    testEmail: string;          // Test email address
  };

  // Default case study for fallback matching (used when no industry/problem match is found)
  // Also used for low-quality lead emails
  defaultCaseStudyId: string | null;

  // Experimental features
  experimental: {
    caseStudies: boolean;  // When true, case studies are shown on lead detail page and appended to emails
  };

  updated_at: Date | Timestamp;
  updated_by: string;
}

// Default configuration values
export const DEFAULT_CONFIGURATION: Omit<Configuration, 'updated_at' | 'updated_by'> = {
  thresholds: {
    highQuality: 0.98,
    lowQuality: 0.51,
    support: 0.9,
  },
  allowHighQualityAutoSend: false,  // Require human review for meeting offers by default
  sdr: {
    name: 'Ryan',
    lastName: 'Hemelt',
    email: 'ryan@vercel.com',
    title: 'Development Representative',
    avatar: 'https://vercel.com/api/www/avatar?u=rauchg&s=64',
  },
  supportTeam: {
    name: 'Support Team',
    email: 'support@vercel.com',
  },
  // All email templates are stored as HTML
  emailTemplates: {
    highQuality: {
      subject: 'Hi from Vercel',
      greeting: '<p>Hi {firstName},</p>',
      callToAction: '<p>Let\'s schedule a quick 15 minute call to get started. <a href="{baseUrl}/sent-emails/{leadId}">Book a Meeting</a></p>',
      signOff: '<p>Best,</p>',
    },
    lowQuality: {
      subject: 'Thanks for your interest in Vercel',
      body: `<p>Hi {firstName},</p>
<p>Thanks for reaching out! We appreciate your interest in Vercel.</p>
<p>Check out <a href="https://vercel.com/customers">vercel.com/customers</a> to see how companies are using our platform.</p>
<p>Best,</p>
<p>Vercel Sales</p>`,
      senderName: 'Vercel Sales',
      senderEmail: 'sales@vercel.com',
    },
    support: {
      subject: 'Looking for support?',
      greeting: '<p>Hi {firstName},</p>',
      body: `<p>Thanks for reaching out to Vercel!</p>
<p>It looks like you're looking for support. Our support team has been notified of your request and will reach out if they can help.</p>
<p>Best,</p>
<p>Vercel Sales</p>
<hr style="border: none; border-top: 1px solid #333; margin: 16px 0;">
<p style="color: #666;"><strong>Not looking for support?</strong><br>
<a href="{baseUrl}/reroute/{leadId}">Tell us more</a></p>`,
    },
    duplicate: {
      subject: 'Looking for Account Support?',
      greeting: '<p>Hi {firstName},</p>',
      body: `<p>Thanks for reaching out to Vercel!</p>
<p>Our records show {company} already has an assigned account team at Vercel. They'll be reaching out to you.</p>
<p>Did we get that wrong? <a href="{baseUrl}/reroute/{leadId}">Give us more info</a></p>
<p>Best,</p>
<p>Vercel Sales</p>`,
    },
    supportInternal: {
      subject: 'Support Request from {firstName} at {company}',
      body: `<p>A new support request has been received.</p>
<p><strong>From:</strong> {firstName} ({email})<br><strong>Company:</strong> {company}</p>
<p><strong>Message:</strong><br>{message}</p>
<p>Please respond to this request.</p>
<hr style="border: none; border-top: 1px solid #333; margin: 16px 0;">
<p style="color: #666;"><strong>Not a support request?</strong><br>
<a href="{baseUrl}/send-back/{leadId}?team=support">Send it back</a> · <a href="{baseUrl}/send-back/{leadId}?team=support&withNote=true">Send it back with a note</a> · <a href="{baseUrl}/self-service/{leadId}">Mark as self-service</a></p>`,
    },
    duplicateInternal: {
      subject: 'Existing Customer Inquiry: {firstName} at {company}',
      body: `<p>An existing customer has reached out.</p>
<p><strong>From:</strong> {firstName} ({email})<br><strong>Company:</strong> {company}</p>
<p><strong>Message:</strong><br>{message}</p>
<p>CRM Info: See lead details for account context.</p>
<hr style="border: none; border-top: 1px solid #333; margin: 16px 0;">
<p style="color: #666;"><strong>Not a duplicate?</strong><br>
<a href="{baseUrl}/send-back/{leadId}?team=account">Send it back</a> · <a href="{baseUrl}/send-back/{leadId}?team=account&withNote=true">Send it back with a note</a></p>`,
    },
  },
  prompts: {
    classification: CLASSIFICATION_PROMPT,
    emailHighQuality: EMAIL_GENERATION_PROMPT,
  },
  rollout: {
    percentage: 1,
  },
  email: {
    enabled: true,
    testMode: true,
    testEmail: 'reed.klaeser@gmail.com',
  },
  defaultCaseStudyId: 'notion',  // Notion is the default fallback case study
  experimental: {
    caseStudies: false,  // Case studies disabled by default
  },
};

// =============================================================================
// ANALYTICS
// =============================================================================

export type AnalyticsEventType =
  | 'classified'
  | 'email_generated'
  | 'email_edited'
  | 'email_approved'
  | 'email_rejected'
  | 'reclassified'
  | 'meeting_booked'
  | 'lead_forwarded'
  | 'human_ai_comparison';

export interface AnalyticsEvent {
  id: string;
  lead_id: string;
  event_type: AnalyticsEventType;
  data: Record<string, unknown>;
  recorded_at: Date | Timestamp;
}

export interface ConfigurationMetrics {
  configuration_id: string;
  total_leads: number;
  emails_generated: number;
  emails_sent: number;
  emails_rejected: number;
  approval_rate: number;
  edit_rate: number;
  avg_response_time_ms: number;
  avg_time_to_booking_ms: number | null;
  rerouted_count: number;
  classification_breakdown: {
    'high-quality': number;
    'low-quality': number;
    support: number;
    duplicate: number;
    'customer-reroute': number;
  };
  first_lead_at: Date | Timestamp | null;
  last_lead_at: Date | Timestamp | null;
  deployment_version?: number;
}

// =============================================================================
// FORM SUBMISSION (client-side)
// =============================================================================

export interface LeadFormData {
  name: string;
  email: string;
  company: string;
  message: string;
}

// =============================================================================
// AI RESPONSES
// =============================================================================

export interface ClassificationResult {
  classification: Classification;
  confidence: number;
  reasoning: string;
  existingCustomer: boolean;  // True if CRM lookup found existing customer relationship
}

export interface EmailGenerationResult {
  subject: string;
  body: string;
  includedCaseStudies: string[]; // Company names mentioned in the email
}

import { Timestamp } from "firebase/firestore";

// =============================================================================
// ENUMS
// =============================================================================

// Classification types - what kind of lead is this?
export type Classification =
  | 'high-quality'   // Strong fit, gets personalized meeting offer email
  | 'low-quality'    // Real opportunity but not a fit, gets generic sales email
  | 'support'        // Existing customer needing help, forwarded to support
  | 'duplicate'      // Already a customer in CRM, forwarded to account team
  | 'irrelevant';    // Spam/test/nonsense, no email sent

// Status types - where is this lead in the workflow?
export type LeadStatus = 'review' | 'done';

// Terminal state - derived from status + classification when status = 'done'
export type TerminalState =
  | 'sent_meeting_offer'      // high-quality lead, personalized email sent
  | 'sent_generic'            // low-quality lead, generic sales email sent
  | 'forwarded_support'       // support lead, forwarded to support team
  | 'forwarded_account_team'  // duplicate lead, forwarded to account team
  | 'dead';                   // irrelevant lead, no email sent

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
  irrelevant: {
    key: 'irrelevant',
    label: 'Irrelevant',
    description: 'Spam, test submission, or otherwise irrelevant',
    colors: {
      text: '#a1a1a1',
      background: 'rgba(161, 161, 161, 0.1)',
      border: 'rgba(161, 161, 161, 0.2)',
    },
    action: {
      short: 'Mark Dead',
      long: 'Mark Dead',
      color: '#ef4444',  // Red for destructive action
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
  dead: {
    key: 'dead',
    label: 'Dead',
    colors: {
      text: '#a1a1a1',
      background: 'rgba(161, 161, 161, 0.1)',
      border: 'rgba(161, 161, 161, 0.2)',
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
}

// Bot generated email text (only highQualityText is AI-generated; lowQuality uses static template)
export interface BotText {
  highQualityText: string;
  lowQualityText: string | null;  // Deprecated - low-quality leads use static template
}

// Bot rollout decision
export interface BotRollout {
  rollOut: number;  // 0-1 percentage chance of auto-send
  useBot: boolean;
}

// Human edits to email
export interface HumanEdits {
  note: string | null;  // Context on tone or word choices that caused a rewrite
  versions: Array<{
    text: string;
    timestamp: Date | Timestamp;
  }>;
}

// Lead status information
export interface StatusInfo {
  status: LeadStatus;
  received_at: Date | Timestamp;
  sent_at: Date | Timestamp | null;
  sent_by: string | null;  // "bot" or user name like "Ryan"
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
  bot_text: BotText | null;
  bot_rollout: BotRollout | null;

  // Human edits (null if no edits)
  human_edits: HumanEdits | null;

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
    case 'irrelevant': return 'dead';
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
  { key: 'review', label: 'Review', color: '#f97316' },  // orange-500
  { key: 'done', label: 'Done', color: '#22c55e' },      // green-500
];

// Type filter options (matches classification)
export const TYPE_FILTER_OPTIONS: FilterOption[] = [
  { key: 'high-quality', label: 'High Quality', color: '#22c55e' },  // green-500
  { key: 'low-quality', label: 'Low Quality', color: '#a1a1a1' },    // gray
  { key: 'support', label: 'Support', color: '#3b82f6' },            // blue-500
  { key: 'duplicate', label: 'Duplicate', color: '#a855f7' },        // purple-500
  { key: 'irrelevant', label: 'Irrelevant', color: '#ef4444' },      // red-500
  { key: 'unclassified', label: 'Unclassified', color: '#f97316' },  // orange-500
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
    highQuality: number;    // Default 0.95 - auto-send meeting offer
    lowQuality: number;     // Default 0.9 - auto-send generic email
    support: number;        // Default 0.9 - auto-forward to support
    duplicate: number;      // Default 0.9 - auto-forward to account team
    irrelevant: number;     // Default 0.85 - auto-mark as dead
  };

  sdr: {
    name: string;
    email: string;
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
      callToAction: string;
      signOff: string;
      senderName: string;
      senderEmail: string;
    };
    duplicate: {
      subject: string;
      greeting: string;
      callToAction: string;
      signOff: string;
      senderName: string;
      senderEmail: string;
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
    emailLowQuality: string;
    emailGeneric: string;
  };

  rollout: {
    enabled: boolean;
    percentage: number;  // 0-1
  };

  email: {
    enabled: boolean;           // Master switch for sending emails
    testMode: boolean;          // When true, all emails go to testEmail
    testEmail: string;          // Test email address
  };

  updated_at: Date | Timestamp;
  updated_by: string;
}

// Default configuration values
export const DEFAULT_CONFIGURATION: Omit<Configuration, 'updated_at' | 'updated_by'> = {
  thresholds: {
    highQuality: 0.95,
    lowQuality: 0.9,
    support: 0.9,
    duplicate: 0.9,
    irrelevant: 0.85,
  },
  sdr: {
    name: 'Ryan',
    email: 'ryan@vercel.com',
  },
  supportTeam: {
    name: 'Support Team',
    email: 'support@vercel.com',
  },
  emailTemplates: {
    highQuality: {
      subject: 'Hi from Vercel',
      greeting: 'Hi {firstName},',
      callToAction: '<a href="https://inbound-ten.vercel.app/sent-emails/{leadId}">Schedule a quick 15-minute call</a> to discuss how Vercel can help.',
      signOff: 'Best,',
    },
    lowQuality: {
      subject: 'Thanks for your interest in Vercel',
      body: `<p>Hi there,</p>
<p>Thanks for reaching out! We appreciate your interest in Vercel.</p>
<p>Check out <a href="https://vercel.com/customers">vercel.com/customers</a> to see how companies are using our platform.</p>
<p>Best,<br>The Vercel Team</p>`,
      senderName: 'The Vercel Team',
      senderEmail: 'sales@vercel.com',
    },
    support: {
      subject: "We've Got Your Request",
      greeting: 'Hi {firstName},',
      callToAction: 'A member of our support team will follow up within one business day. For urgent issues, visit <a href="https://vercel.com/help">vercel.com/help</a> to access our documentation and live chat.',
      signOff: 'Best,',
      senderName: 'The Vercel Team',
      senderEmail: 'support@vercel.com',
    },
    duplicate: {
      subject: "We've Got Your Request",
      greeting: 'Hi {firstName},',
      callToAction: "Since you're already part of the Vercel family, we've routed this directly to your account team. They'll follow up with you personally.",
      signOff: 'Best,',
      senderName: 'The Vercel Team',
      senderEmail: 'sales@vercel.com',
    },
    supportInternal: {
      subject: 'Support Request from {firstName} at {company}',
      body: 'A new support request has been received.\n\nFrom: {firstName} ({email})\nCompany: {company}\n\nMessage:\n{message}\n\nPlease respond to this request.',
    },
    duplicateInternal: {
      subject: 'Existing Customer Inquiry: {firstName} at {company}',
      body: 'An existing customer has reached out.\n\nFrom: {firstName} ({email})\nCompany: {company}\n\nMessage:\n{message}\n\nCRM Info: See lead details for account context.',
    },
  },
  prompts: {
    classification: '',  // Will be populated from prompts.ts
    emailHighQuality: '',
    emailLowQuality: '',
    emailGeneric: '',
  },
  rollout: {
    enabled: false,
    percentage: 0,
  },
  email: {
    enabled: true,
    testMode: true,
    testEmail: 'reed.klaeser@gmail.com',
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
    irrelevant: number;
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
}

export interface EmailGenerationResult {
  subject: string;
  body: string;
}

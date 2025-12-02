import { Timestamp } from "firebase/firestore";
import { type Industry } from "./case-studies";

// =============================================================================
// ENUMS
// =============================================================================

// Classification types - what kind of lead is this?
export type Classification =
  | 'high-quality'      // Strong fit, gets personalized meeting offer email
  | 'low-quality'       // Not a fit or spam/nonsense, gets generic sales email
  | 'support'           // Existing customer needing help, forwarded to support
  | 'existing';         // Already a customer in CRM, forwarded to account team

// Status types - where is this lead in the workflow?
// processing: workflow is running (lead just submitted, AI processing in progress)
// classify: waiting for human to classify (AI classification rate check failed)
// review: AI classified, waiting for human to review/approve
// done: action taken (email sent or forwarded)
export type LeadStatus = 'processing' | 'classify' | 'review' | 'done';

// Terminal state - derived from status + classification when status = 'done'
export type TerminalState =
  | 'sent_meeting_offer'      // high-quality lead, personalized email sent
  | 'sent_generic'            // low-quality lead, generic sales email sent
  | 'forwarded_support'       // support lead, forwarded to support team
  | 'forwarded_account_team'; // existing customer lead, forwarded to account team

// =============================================================================
// REROUTE DATA MODEL
// =============================================================================

// Reroute source - who initiated the reroute
export type RerouteSource = 'customer' | 'support' | 'sales';

// Reroute entry - feedback from customer or internal team that the classification was wrong
export interface Reroute {
  id: string;
  source: RerouteSource;
  reason?: string;
  originalClassification: Classification;
  previousTerminalState?: TerminalState;  // What was sent before reroute (if any)
  timestamp: Date | Timestamp;
}

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
}

export const CLASSIFICATIONS: Record<Classification, ClassificationConfig> = {
  'high-quality': {
    key: 'high-quality',
    label: 'High Quality',
    description: 'High-value lead with clear product-market fit',
    colors: {
      text: '#16a34a',
      background: 'rgba(34, 197, 94, 0.15)',
      border: 'rgba(34, 197, 94, 0.35)',
    },
  },
  'low-quality': {
    key: 'low-quality',
    label: 'Low Quality',
    description: 'Real opportunity but not a good fit for personalized outreach',
    colors: {
      text: '#525252',
      background: 'rgba(115, 115, 115, 0.15)',
      border: 'rgba(115, 115, 115, 0.35)',
    },
  },
  support: {
    key: 'support',
    label: 'Support',
    description: 'Existing customer with support request',
    colors: {
      text: '#2563eb',
      background: 'rgba(59, 130, 246, 0.15)',
      border: 'rgba(59, 130, 246, 0.35)',
    },
  },
  existing: {
    key: 'existing',
    label: 'Existing',
    description: 'Existing customer in CRM',
    colors: {
      text: '#9333ea',
      background: 'rgba(168, 85, 247, 0.15)',
      border: 'rgba(168, 85, 247, 0.35)',
    },
  },
};

// Classification helper functions
export function getClassificationLabel(c: Classification): string {
  return CLASSIFICATIONS[c].label;
}

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
      text: '#16a34a',
      background: 'rgba(34, 197, 94, 0.15)',
      border: 'rgba(34, 197, 94, 0.35)',
    },
  },
  sent_generic: {
    key: 'sent_generic',
    label: 'Generic Message Sent',
    colors: {
      text: '#525252',
      background: 'rgba(115, 115, 115, 0.15)',
      border: 'rgba(115, 115, 115, 0.35)',
    },
  },
  forwarded_support: {
    key: 'forwarded_support',
    label: 'Forwarded to Support',
    colors: {
      text: '#2563eb',
      background: 'rgba(59, 130, 246, 0.15)',
      border: 'rgba(59, 130, 246, 0.35)',
    },
  },
  forwarded_account_team: {
    key: 'forwarded_account_team',
    label: 'Forwarded to Account Team',
    colors: {
      text: '#9333ea',
      background: 'rgba(168, 85, 247, 0.15)',
      border: 'rgba(168, 85, 247, 0.35)',
    },
  },
};

// =============================================================================
// MATCHED CASE STUDIES (for customer success page)
// =============================================================================

export interface MatchedCaseStudy {
  caseStudyId: string;
  company: string;
  industry: Industry;  // Use Industry type instead of string for type safety
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
    expectedClassification: Classification;
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

  // Reroute information (optional - set when lead is rerouted by customer or internal team)
  // Only one reroute per lead is supported
  reroute?: Reroute;

  // Evaluation results (optional - populated when eval is run)
  eval_results?: {
    classification?: {
      score: number;              // 1-5
      pass: boolean;
      reasoning: string;
      evaluated_at: Date | Timestamp;
      model: string;              // e.g., "gpt-4o"
    };
    email?: {
      scores: {
        relevant: number;   // 1-5: Does it address their specific stated need?
        direct: number;     // 1-5: Is it concise and to the point?
        active: number;     // 1-5: Does it use action-oriented language?
      };
      overall: number;
      pass: boolean;
      summary: string;
      evaluated_at: Date | Timestamp;
      model: string;
    };
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
    case 'existing': return 'forwarded_account_team';
    default: return null;
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

// =============================================================================
// FILTER OPTIONS (for AllLeads UI filtering)
// =============================================================================

// Status filter options (matches lead.status.status)
export const STATUS_FILTER_OPTIONS = [
  { key: 'processing', label: 'Processing', color: '#8b5cf6' },  // violet-500
  { key: 'classify', label: 'Classify', color: '#eab308' },  // yellow-500
  { key: 'review', label: 'Review', color: '#f97316' },      // orange-500
  { key: 'done', label: 'Done', color: '#22c55e' },          // green-500
];

// Type filter options (matches classification)
export const TYPE_FILTER_OPTIONS = [
  { key: 'high-quality', label: 'High Quality', color: '#16a34a' },        // green-600
  { key: 'low-quality', label: 'Low Quality', color: '#525252' },          // neutral-600
  { key: 'support', label: 'Support', color: '#2563eb' },                  // blue-600
  { key: 'existing', label: 'Existing', color: '#9333ea' },                // purple-600
  { key: 'rerouted', label: 'Rerouted', color: '#d97706' },                // amber-600 (leads with reroute field set)
  { key: 'unclassified', label: 'Unclassified', color: '#ea580c' },        // orange-600
];

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
    // Note: existing threshold removed - existing customers always auto-forward via deterministic CRM check
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
    existing: {
      subject: string;
      greeting: string;
      body: string;
    };
    // Internal notifications (sent to internal teams, not customers)
    supportInternal: {
      subject: string;
      body: string;
    };
    existingInternal: {
      subject: string;
      body: string;
    };
  };

  prompts: {
    classification: string;
    emailHighQuality: string;
    // Evaluation prompts (LLM-as-judge)
    classificationEval: string;
    emailHighQualityEval: string;
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

  // Response to lead toggles - when false, no customer email is sent for these classifications
  responseToLead: {
    lowQuality: boolean;    // default: false - no generic email to customer
    support: boolean;       // default: false - no acknowledgment to customer (still forwards internally)
    existing: boolean;      // default: false - no acknowledgment to customer (still forwards internally)
  };

  updated_at: Date | Timestamp;
  updated_by: string;
}

// Default configuration values - re-exported from settings-defaults
export { DEFAULT_CONFIGURATION } from './settings-defaults';

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

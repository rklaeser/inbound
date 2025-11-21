import { Timestamp } from "firebase/firestore";

// Lead classification types
export type LeadClassification = 'quality' | 'support' | 'low-value' | 'irrelevant' | 'uncertain' | 'dead' | 'duplicate';

// Forward destination types (deprecated - use specific forwarded outcomes instead)
export type ForwardDestination = 'support' | 'account_team';

// Autonomy level - WHO made the decision
export type LeadAutonomy = 'review' | 'auto' | null;

// Lead outcome - WHAT happened (final result)
export type LeadOutcome = 'pending' | 'sent_meeting_offer' | 'sent_generic' | 'dead' | 'forwarded_account_team' | 'forwarded_support' | 'error' | null;

// Main Lead interface
export interface Lead {
  id: string;

  // Lead information
  name: string;
  email: string;
  company: string;
  message: string;

  // Classification
  classification: LeadClassification | null;
  confidence_score: number | null;
  reasoning: string | null;

  // Research data
  research_report: string | null;
  person_job_title: string | null;
  person_linkedin_url: string | null;

  // Email generation
  generated_email_subject: string | null;
  generated_email_body: string | null;
  final_email_subject: string | null;
  final_email_body: string | null;
  edited: boolean;

  // New data model - separates WHO decided from WHAT happened
  autonomy: LeadAutonomy;  // WHO: human ('review') or system ('auto')
  outcome: LeadOutcome;    // WHAT: pending, sent, dead, forwarded, error, or null (processing)
  error_message?: string;  // Error details if outcome is "error"

  // Configuration tracking
  configuration_id: string | null;

  // Timestamps
  created_at: Timestamp | Date;
  classified_at: Timestamp | Date | null;
  reviewed_at: Timestamp | Date | null;
  edited_at: Timestamp | Date | null;
  closed_at: Timestamp | Date | null;  // When lead was completed (sent/dead/forwarded)
  meeting_booked_at: Timestamp | Date | null;

  // Attribution tracking
  reviewed_by: string | null;
  edited_by: string | null;
  closed_by: string | null;  // Who completed the lead
  forwarded_to: ForwardDestination | null;

  // Test metadata (optional - only present for test leads)
  metadata?: {
    isTestLead: boolean;
    testCase: string;
    expectedClassifications: readonly LeadClassification[];
  };
}

// Form submission type (client-side)
export interface LeadFormData {
  name: string;
  email: string;
  company: string;
  message: string;
}

// AI Classification response
export interface ClassificationResult {
  classification: LeadClassification;
  confidence: number;
  reasoning: string;
}

// AI Email generation response
export interface EmailGenerationResult {
  subject: string;
  body: string;
}

// Analytics event
export interface Analytic {
  id: string;
  lead_id: string;
  event_type: 'classification' | 'email_edit' | 'sent';
  data: any;
  recorded_at: Timestamp | Date;
}

// System settings
export interface SystemSettings {
  // Auto-action thresholds
  autoDeadLowValueThreshold: number;
  autoForwardDuplicateThreshold: number;
  autoForwardSupportThreshold: number;
  autoSendQualityThreshold: number;
  qualityLeadConfidenceThreshold: number;
  sdr: {
    name: string;
    email: string;
  };
  updated_at?: Timestamp | Date;
}

// Configuration status
export type ConfigurationStatus = 'draft' | 'active' | 'archived';

// System configuration
export interface Configuration {
  id: string;
  version: number;
  name: string;
  status: ConfigurationStatus;

  // Configuration snapshot
  settings: {
    // Auto-action thresholds for each classification type
    autoDeadLowValueThreshold: number;        // Auto-dead low-value leads above this confidence (real but not a fit)
    autoDeadIrrelevantThreshold: number;      // Auto-dead irrelevant leads above this confidence (spam/nonsense)
    autoForwardDuplicateThreshold: number;    // Auto-forward duplicates above this confidence
    autoForwardSupportThreshold: number;      // Auto-forward support requests above this confidence
    autoSendQualityThreshold: number;         // Auto-send quality emails above this confidence (future)
    qualityLeadConfidenceThreshold: number;   // Minimum confidence to classify as quality (not for auto-action)
  };
  emailTemplate: {
    style?: string;
    subject?: string;
    greeting?: string;
    signOff?: string;
    callToAction?: string;
    lowValueCallToAction?: string;
  };

  // Metadata
  created_by: string;
  activated_at: Timestamp | Date | null;
  created_at: Timestamp | Date;
  archived_at: Timestamp | Date | null;
}

// Analytics event types
export type AnalyticsEventType =
  | 'classified'
  | 'email_generated'
  | 'email_edited'
  | 'email_approved'
  | 'email_rejected'
  | 'reclassified'
  | 'meeting_booked'
  | 'lead_forwarded';

// Analytics event
export interface AnalyticsEvent {
  id: string;
  configuration_id: string;
  lead_id: string;
  event_type: AnalyticsEventType;
  data: {
    // For 'classified': { classification, confidence }
    // For 'email_generated': { subject, body }
    // For 'email_edited': { changes_made, edit_percentage }
    // For 'email_approved': { time_to_approval_ms }
    // For 'email_rejected': { reason }
    // For 'reclassified': { old_classification, new_classification }
    // For 'meeting_booked': { time_to_booking_ms }
    // For 'lead_forwarded': { forwarded_to, forwarded_by }
    [key: string]: any;
  };
  recorded_at: Timestamp | Date;
}

// Configuration metrics (computed)
export interface ConfigurationMetrics {
  configuration_id: string;

  // Counts
  total_leads: number;
  emails_generated: number;
  emails_sent: number;
  emails_rejected: number;

  // Rates (percentages)
  approval_rate: number;      // (emails_sent / emails_generated) * 100
  edit_rate: number;          // (edited_emails / emails_sent) * 100
  classification_accuracy?: number;

  // Timing
  avg_response_time_ms: number;  // Average time from created_at to sent_at
  avg_time_to_booking_ms: number | null;  // Average time from sent_at to meeting_booked_at

  // Negative metrics
  rerouted_count: number;  // Count of leads manually forwarded to support/AE

  // Classification breakdown
  classification_breakdown: {
    quality: number;
    support: number;
    'low-value': number;
    uncertain: number;
    dead: number;
    duplicate: number;
  };

  // Time range
  first_lead_at: Timestamp | Date | null;
  last_lead_at: Timestamp | Date | null;
}

// Helper functions for analytics event logging

import { adminDb } from "./firestore-admin";
import type { AnalyticsEvent, AnalyticsEventType, Lead, Classification } from "./types";
import { getCurrentClassification, getTerminalState } from "./types";

/**
 * Log an analytics event
 */
export async function logAnalyticsEvent(
  lead_id: string,
  event_type: AnalyticsEventType,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const event: Omit<AnalyticsEvent, 'id'> = {
      lead_id,
      event_type,
      data,
      recorded_at: new Date(),
    };

    await adminDb.collection("analytics_events").add(event);
  } catch (error) {
    console.error("Error logging analytics event:", error);
    // Don't throw - analytics failures shouldn't break the main flow
  }
}

/**
 * Log a classification event
 */
export async function logClassificationEvent(
  lead: Lead,
  classification: Classification,
  confidence: number,
  reasoning: string
): Promise<void> {
  await logAnalyticsEvent(
    lead.id,
    "classified",
    {
      classification,
      confidence,
      reasoning,
    }
  );
}

/**
 * Log an email generation event
 */
export async function logEmailGenerationEvent(
  lead: Lead,
  subject: string,
  body: string
): Promise<void> {
  await logAnalyticsEvent(
    lead.id,
    "email_generated",
    {
      subject,
      body,
      body_length: body.length,
    }
  );
}

/**
 * Log an email edit event
 */
export async function logEmailEditEvent(
  lead: Lead,
  originalSubject: string,
  originalBody: string,
  editedSubject: string,
  editedBody: string
): Promise<void> {
  // Calculate edit percentage (simple character diff)
  const originalLength = originalSubject.length + originalBody.length;
  const editedLength = editedSubject.length + editedBody.length;
  const lengthDiff = Math.abs(editedLength - originalLength);
  const editPercentage = originalLength > 0 ? (lengthDiff / originalLength) * 100 : 0;

  await logAnalyticsEvent(
    lead.id,
    "email_edited",
    {
      original_subject: originalSubject,
      original_body: originalBody,
      edited_subject: editedSubject,
      edited_body: editedBody,
      edit_percentage: Math.round(editPercentage * 100) / 100,
      original_length: originalLength,
      edited_length: editedLength,
    }
  );
}

/**
 * Log an email approval event
 */
export async function logEmailApprovalEvent(
  lead: Lead,
  timeToApprovalMs: number
): Promise<void> {
  await logAnalyticsEvent(
    lead.id,
    "email_approved",
    {
      time_to_approval_ms: timeToApprovalMs,
      time_to_approval_minutes: Math.round(timeToApprovalMs / 1000 / 60),
      classification: getCurrentClassification(lead),
      terminal_state: getTerminalState(lead),
    }
  );
}

/**
 * Log an email rejection event
 */
export async function logEmailRejectionEvent(
  lead: Lead,
  reason?: string
): Promise<void> {
  await logAnalyticsEvent(
    lead.id,
    "email_rejected",
    {
      reason: reason || "unknown",
      classification: getCurrentClassification(lead),
      confidence: lead.bot_research?.confidence,
    }
  );
}

/**
 * Log a reclassification event (when human overrides AI classification)
 */
export async function logReclassificationEvent(
  lead: Lead,
  oldClassification: Classification,
  newClassification: Classification
): Promise<void> {
  await logAnalyticsEvent(
    lead.id,
    "reclassified",
    {
      old_classification: oldClassification,
      new_classification: newClassification,
      original_confidence: lead.bot_research?.confidence,
      was_bot_classification: lead.classifications.some(c => c.author === 'bot' && c.classification === oldClassification),
    }
  );
}

/**
 * Log a meeting booked event
 */
export async function logMeetingBookedEvent(
  lead: Lead,
  timeToBookingMs: number
): Promise<void> {
  await logAnalyticsEvent(
    lead.id,
    "meeting_booked",
    {
      time_to_booking_ms: timeToBookingMs,
      time_to_booking_minutes: Math.round(timeToBookingMs / 1000 / 60),
      time_to_booking_hours: Math.round(timeToBookingMs / 1000 / 60 / 60),
    }
  );
}

/**
 * Log a lead forwarded event
 */
export async function logLeadForwardedEvent(
  lead: Lead,
  forwardedTo: 'support' | 'account_team',
  forwardedBy: string
): Promise<void> {
  await logAnalyticsEvent(
    lead.id,
    "lead_forwarded",
    {
      forwarded_to: forwardedTo,
      forwarded_by: forwardedBy,
      classification: getCurrentClassification(lead),
      terminal_state: getTerminalState(lead),
    }
  );
}

/**
 * Log human vs AI comparison event
 */
export async function logHumanAIComparisonEvent(
  lead: Lead,
  aiClassification: Classification,
  aiConfidence: number,
  humanClassification: Classification
): Promise<void> {
  const agreement = aiClassification === humanClassification;

  await logAnalyticsEvent(
    lead.id,
    "human_ai_comparison",
    {
      ai_classification: aiClassification,
      ai_confidence: aiConfidence,
      human_classification: humanClassification,
      agreement,
      confidence_bucket: getConfidenceBucket(aiConfidence),
    }
  );
}

/**
 * Helper function to bucket confidence scores
 */
function getConfidenceBucket(confidence: number): string {
  if (confidence < 0.5) return '0-50%';
  if (confidence < 0.7) return '50-70%';
  if (confidence < 0.9) return '70-90%';
  return '90-100%';
}

// =============================================================================
// DERIVED ANALYTICS (from business-logic.md)
// =============================================================================

/**
 * Calculate processing time for a lead
 * processingTime = bot_research.timestamp - status.received_at
 */
export function getProcessingTime(lead: Lead): number | null {
  if (!lead.bot_research?.timestamp || !lead.status.received_at) {
    return null;
  }

  const researchTime = lead.bot_research.timestamp instanceof Date
    ? lead.bot_research.timestamp.getTime()
    : (lead.bot_research.timestamp as any).toDate().getTime();

  const receivedTime = lead.status.received_at instanceof Date
    ? lead.status.received_at.getTime()
    : (lead.status.received_at as any).toDate().getTime();

  return researchTime - receivedTime;
}

/**
 * Calculate time to send for a lead
 * timeToSend = status.sent_at - status.received_at
 */
export function getTimeToSend(lead: Lead): number | null {
  if (!lead.status.sent_at || !lead.status.received_at) {
    return null;
  }

  const sentTime = lead.status.sent_at instanceof Date
    ? lead.status.sent_at.getTime()
    : (lead.status.sent_at as any).toDate().getTime();

  const receivedTime = lead.status.received_at instanceof Date
    ? lead.status.received_at.getTime()
    : (lead.status.received_at as any).toDate().getTime();

  return sentTime - receivedTime;
}

/**
 * Calculate human override rate for a set of leads
 * overrideRate = leads.filter(l => l.classifications.length > 1).length / leads.length
 */
export function getHumanOverrideRate(leads: Lead[]): number {
  if (leads.length === 0) return 0;

  const overriddenCount = leads.filter(l => l.classifications.length > 1).length;
  return overriddenCount / leads.length;
}

/**
 * Calculate auto-send rate for a set of leads
 * Leads with single bot classification that went to done
 */
export function getAutoSendRate(leads: Lead[]): number {
  if (leads.length === 0) return 0;

  const autoSentCount = leads.filter(l =>
    l.classifications.length === 1 &&
    l.classifications[0].author === 'bot' &&
    l.status.status === 'done'
  ).length;

  return autoSentCount / leads.length;
}

/**
 * Calculate bot accuracy on sampled leads
 * Compare bot classification to human classification on leads that went through review
 */
export function getBotAccuracy(leads: Lead[]): number | null {
  // Only consider leads where human reclassified (has > 1 classification)
  const sampledLeads = leads.filter(l => l.classifications.length > 1);

  if (sampledLeads.length === 0) return null;

  // Check if human agreed with bot (comparing positions 0 and 1)
  // Position 0 = human (most recent), Position 1 = bot (original)
  const matches = sampledLeads.filter(l =>
    l.classifications[0].classification === l.classifications[1].classification
  );

  return matches.length / sampledLeads.length;
}

/**
 * Get classification breakdown for a set of leads
 */
export function getClassificationBreakdown(leads: Lead[]): Record<Classification, number> {
  const breakdown: Record<Classification, number> = {
    'high-quality': 0,
    'low-quality': 0,
    'support': 0,
    'duplicate': 0,
    'customer-reroute': 0,
    'internal-reroute': 0,
  };

  leads.forEach(lead => {
    const classification = getCurrentClassification(lead);
    if (classification) {
      breakdown[classification]++;
    }
  });

  return breakdown;
}

/**
 * Get confidence distribution by classification
 */
export function getConfidenceByClassification(leads: Lead[]): Array<{
  classification: Classification;
  avgConfidence: number;
  count: number;
}> {
  const grouped: Record<Classification, number[]> = {
    'high-quality': [],
    'low-quality': [],
    'support': [],
    'duplicate': [],
    'customer-reroute': [],
    'internal-reroute': [],
  };

  leads.forEach(lead => {
    if (lead.bot_research) {
      grouped[lead.bot_research.classification].push(lead.bot_research.confidence);
    }
  });

  return Object.entries(grouped).map(([cls, confidences]) => ({
    classification: cls as Classification,
    avgConfidence: confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0,
    count: confidences.length,
  }));
}

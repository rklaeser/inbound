// Helper functions for analytics event logging

import { adminDb } from "./firestore-admin";
import type { AnalyticsEvent, AnalyticsEventType, Lead } from "./types";

/**
 * Log an analytics event
 * @param lead_id - The lead ID
 * @param configuration_id - The configuration ID
 * @param event_type - The type of event
 * @param data - Event-specific data
 */
export async function logAnalyticsEvent(
  lead_id: string,
  configuration_id: string,
  event_type: AnalyticsEventType,
  data: Record<string, any>
): Promise<void> {
  try {
    const event: Omit<AnalyticsEvent, 'id'> = {
      lead_id,
      configuration_id,
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
  classification: string,
  confidence: number,
  reasoning: string
): Promise<void> {
  if (!lead.configuration_id) {
    console.warn("Lead missing configuration_id, skipping analytics event");
    return;
  }

  await logAnalyticsEvent(
    lead.id,
    lead.configuration_id,
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
  if (!lead.configuration_id) {
    console.warn("Lead missing configuration_id, skipping analytics event");
    return;
  }

  await logAnalyticsEvent(
    lead.id,
    lead.configuration_id,
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
  if (!lead.configuration_id) {
    console.warn("Lead missing configuration_id, skipping analytics event");
    return;
  }

  // Calculate edit percentage (simple character diff)
  const originalLength = originalSubject.length + originalBody.length;
  const editedLength = editedSubject.length + editedBody.length;
  const lengthDiff = Math.abs(editedLength - originalLength);
  const editPercentage = originalLength > 0 ? (lengthDiff / originalLength) * 100 : 0;

  await logAnalyticsEvent(
    lead.id,
    lead.configuration_id,
    "email_edited",
    {
      original_subject: originalSubject,
      original_body: originalBody,
      edited_subject: editedSubject,
      edited_body: editedBody,
      edit_percentage: Math.round(editPercentage * 100) / 100, // Round to 2 decimal places
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
  if (!lead.configuration_id) {
    console.warn("Lead missing configuration_id, skipping analytics event");
    return;
  }

  await logAnalyticsEvent(
    lead.id,
    lead.configuration_id,
    "email_approved",
    {
      time_to_approval_ms: timeToApprovalMs,
      time_to_approval_minutes: Math.round(timeToApprovalMs / 1000 / 60),
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
  if (!lead.configuration_id) {
    console.warn("Lead missing configuration_id, skipping analytics event");
    return;
  }

  await logAnalyticsEvent(
    lead.id,
    lead.configuration_id,
    "email_rejected",
    {
      reason: reason || "unknown",
      classification: lead.classification,
      confidence_score: lead.confidence_score,
    }
  );
}

/**
 * Log a reclassification event (when human overrides AI classification)
 */
export async function logReclassificationEvent(
  lead: Lead,
  oldClassification: string,
  newClassification: string
): Promise<void> {
  if (!lead.configuration_id) {
    console.warn("Lead missing configuration_id, skipping analytics event");
    return;
  }

  await logAnalyticsEvent(
    lead.id,
    lead.configuration_id,
    "reclassified",
    {
      old_classification: oldClassification,
      new_classification: newClassification,
      original_confidence: lead.confidence_score,
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
  if (!lead.configuration_id) {
    console.warn("Lead missing configuration_id, skipping analytics event");
    return;
  }

  await logAnalyticsEvent(
    lead.id,
    lead.configuration_id,
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
  if (!lead.configuration_id) {
    console.warn("Lead missing configuration_id, skipping analytics event");
    return;
  }

  await logAnalyticsEvent(
    lead.id,
    lead.configuration_id,
    "lead_forwarded",
    {
      forwarded_to: forwardedTo,
      forwarded_by: forwardedBy,
      original_classification: lead.classification,
      original_status: lead.outcome,
    }
  );
}

/**
 * Batch log multiple analytics events (for better performance)
 */
export async function logAnalyticsEventsBatch(
  events: Array<{
    lead_id: string;
    configuration_id: string;
    event_type: AnalyticsEventType;
    data: Record<string, any>;
  }>
): Promise<void> {
  try {
    const batch = adminDb.batch();

    events.forEach((event) => {
      const eventData: Omit<AnalyticsEvent, 'id'> = {
        ...event,
        recorded_at: new Date(),
      };

      const ref = adminDb.collection("analytics_events").doc();
      batch.set(ref, eventData);
    });

    await batch.commit();
  } catch (error) {
    console.error("Error logging analytics events batch:", error);
    // Don't throw - analytics failures shouldn't break the main flow
  }
}

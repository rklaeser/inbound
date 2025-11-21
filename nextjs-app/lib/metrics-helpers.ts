// Helper functions for calculating configuration metrics

import { adminDb } from "./firestore-admin";
import type { ConfigurationMetrics, Lead } from "./types";

/**
 * Calculate metrics for a specific configuration
 */
export async function calculateConfigurationMetrics(
  configurationId: string
): Promise<ConfigurationMetrics> {
  // Fetch all leads for this configuration
  const leadsSnapshot = await adminDb
    .collection("leads")
    .where("configuration_id", "==", configurationId)
    .get();

  const leads: Lead[] = leadsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  } as Lead));

  // Calculate counts
  const totalLeads = leads.length;

  // Leads that had emails generated (quality, support, uncertain)
  const leadsWithEmails = leads.filter(
    (lead) =>
      lead.generated_email_subject && lead.generated_email_body
  );
  const emailsGenerated = leadsWithEmails.length;

  // Leads where email was sent (approved)
  const sentLeads = leads.filter((lead) => lead.status === "sent");
  const emailsSent = sentLeads.length;

  // Leads that were rejected
  const rejectedLeads = leads.filter((lead) => lead.status === "dead");
  const emailsRejected = rejectedLeads.length;

  // Calculate approval rate: (sent / generated) * 100
  const approvalRate =
    emailsGenerated > 0 ? (emailsSent / emailsGenerated) * 100 : 0;

  // Calculate edit rate: (edited / sent) * 100
  const editedEmails = sentLeads.filter((lead) => lead.edited === true);
  const editRate = emailsSent > 0 ? (editedEmails.length / emailsSent) * 100 : 0;

  // Calculate average response time (created_at to sent_at)
  let totalResponseTimeMs = 0;
  let responseTimeCount = 0;

  sentLeads.forEach((lead) => {
    if (lead.closed_at && lead.created_at) {
      const sentTime = (lead.closed_at as any).toDate
        ? (lead.closed_at as any).toDate().getTime()
        : (lead.closed_at as Date).getTime();
      const createdTime = (lead.created_at as any).toDate
        ? (lead.created_at as any).toDate().getTime()
        : (lead.created_at as Date).getTime();

      totalResponseTimeMs += sentTime - createdTime;
      responseTimeCount++;
    }
  });

  const avgResponseTimeMs =
    responseTimeCount > 0 ? totalResponseTimeMs / responseTimeCount : 0;

  // Calculate average time to booking (sent_at to meeting_booked_at)
  let totalBookingTimeMs = 0;
  let bookingTimeCount = 0;

  const bookedLeads = leads.filter((lead) => lead.meeting_booked_at);
  bookedLeads.forEach((lead) => {
    if (lead.meeting_booked_at && lead.closed_at) {
      const bookedTime = (lead.meeting_booked_at as any).toDate
        ? (lead.meeting_booked_at as any).toDate().getTime()
        : (lead.meeting_booked_at as Date).getTime();
      const sentTime = (lead.closed_at as any).toDate
        ? (lead.closed_at as any).toDate().getTime()
        : (lead.closed_at as Date).getTime();

      totalBookingTimeMs += bookedTime - sentTime;
      bookingTimeCount++;
    }
  });

  const avgTimeToBookingMs =
    bookingTimeCount > 0 ? totalBookingTimeMs / bookingTimeCount : null;

  // Calculate rerouted count (manually forwarded leads)
  const reroutedCount = leads.filter((lead) => lead.forwarded_to).length;

  // Calculate classification breakdown
  const classificationBreakdown = {
    quality: leads.filter((l) => l.classification === "quality").length,
    support: leads.filter((l) => l.classification === "support").length,
    "low-value": leads.filter((l) => l.classification === "low-value").length,
    uncertain: leads.filter((l) => l.classification === "uncertain").length,
    dead: leads.filter((l) => l.classification === "dead").length,
    duplicate: leads.filter((l) => l.classification === "duplicate").length,
  };

  // Get time range
  const sortedLeads = leads.sort((a, b) => {
    const aTime = (a.created_at as any).toDate
      ? (a.created_at as any).toDate().getTime()
      : (a.created_at as Date).getTime();
    const bTime = (b.created_at as any).toDate
      ? (b.created_at as any).toDate().getTime()
      : (b.created_at as Date).getTime();
    return aTime - bTime;
  });

  const firstLeadAt = sortedLeads.length > 0 ? sortedLeads[0].created_at : null;
  const lastLeadAt =
    sortedLeads.length > 0 ? sortedLeads[sortedLeads.length - 1].created_at : null;

  return {
    configuration_id: configurationId,
    total_leads: totalLeads,
    emails_generated: emailsGenerated,
    emails_sent: emailsSent,
    emails_rejected: emailsRejected,
    approval_rate: Math.round(approvalRate * 100) / 100, // Round to 2 decimal places
    edit_rate: Math.round(editRate * 100) / 100,
    avg_response_time_ms: Math.round(avgResponseTimeMs),
    avg_time_to_booking_ms: avgTimeToBookingMs ? Math.round(avgTimeToBookingMs) : null,
    rerouted_count: reroutedCount,
    classification_breakdown: classificationBreakdown,
    first_lead_at: firstLeadAt,
    last_lead_at: lastLeadAt,
  };
}

/**
 * Calculate metrics for all configurations
 */
export async function calculateAllConfigurationsMetrics(): Promise<ConfigurationMetrics[]> {
  // Fetch all configurations
  const configurationsSnapshot = await adminDb
    .collection("configurations")
    .orderBy("version", "asc")
    .get();

  const metrics: ConfigurationMetrics[] = [];

  for (const doc of configurationsSnapshot.docs) {
    const configurationMetrics = await calculateConfigurationMetrics(doc.id);
    metrics.push(configurationMetrics);
  }

  return metrics;
}

/**
 * Calculate metrics for configurations within a date range
 */
export async function calculateMetricsInDateRange(
  startDate: Date,
  endDate: Date
): Promise<ConfigurationMetrics[]> {
  // Fetch configurations that were active during the date range
  const configurationsSnapshot = await adminDb
    .collection("configurations")
    .where("activated_at", ">=", startDate)
    .where("activated_at", "<=", endDate)
    .orderBy("activated_at", "asc")
    .get();

  const metrics: ConfigurationMetrics[] = [];

  for (const doc of configurationsSnapshot.docs) {
    const configurationMetrics = await calculateConfigurationMetrics(doc.id);
    metrics.push(configurationMetrics);
  }

  return metrics;
}

/**
 * Get summary statistics for a configuration
 */
export async function getConfigurationSummary(configurationId: string) {
  const metrics = await calculateConfigurationMetrics(configurationId);

  return {
    total_leads: metrics.total_leads,
    approval_rate: `${metrics.approval_rate}%`,
    edit_rate: `${metrics.edit_rate}%`,
    avg_response_time: formatResponseTime(metrics.avg_response_time_ms),
    top_classification: getTopClassification(metrics.classification_breakdown),
  };
}

/**
 * Helper: Format response time in human-readable format
 */
function formatResponseTime(ms: number): string {
  const minutes = Math.floor(ms / 1000 / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Helper: Get the most common classification
 */
function getTopClassification(breakdown: {
  [key: string]: number;
}): string {
  let maxCount = 0;
  let topClassification = "none";

  for (const [classification, count] of Object.entries(breakdown)) {
    if (count > maxCount) {
      maxCount = count;
      topClassification = classification;
    }
  }

  return topClassification;
}

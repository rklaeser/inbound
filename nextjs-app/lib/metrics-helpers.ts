// Helper functions for calculating configuration metrics

import { adminDb } from "./firestore-admin";
import type { ConfigurationMetrics, Lead } from "./types";

/**
 * Calculate metrics for a specific configuration
 */
export async function calculateConfigurationMetrics(
  configurationId: string
): Promise<ConfigurationMetrics> {
  // Fetch all leads (no configuration_id filter since we have single config now)
  const leadsSnapshot = await adminDb
    .collection("leads")
    .get();

  const leads: Lead[] = leadsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  } as Lead));

  // Calculate counts
  const totalLeads = leads.length;

  // Leads that had emails generated (have bot_text or human_edits)
  const leadsWithEmails = leads.filter(
    (lead) =>
      (lead.bot_text?.highQualityText || lead.bot_text?.lowQualityText) || lead.human_edits?.versions[0]?.text
  );
  const emailsGenerated = leadsWithEmails.length;

  // Leads where email was sent (status = done and terminal state is sent)
  const { getTerminalState } = await import('./types');
  const sentLeads = leads.filter((lead) => {
    const terminalState = getTerminalState(lead);
    return terminalState === "sent_meeting_offer" || terminalState === "sent_generic";
  });
  const emailsSent = sentLeads.length;

  // Leads that were rejected (terminal state = dead)
  const rejectedLeads = leads.filter((lead) => getTerminalState(lead) === "dead");
  const emailsRejected = rejectedLeads.length;

  // Calculate approval rate: (sent / generated) * 100
  const approvalRate =
    emailsGenerated > 0 ? (emailsSent / emailsGenerated) * 100 : 0;

  // Calculate edit rate: (edited / sent) * 100
  const editedEmails = sentLeads.filter((lead) => lead.human_edits !== null);
  const editRate = emailsSent > 0 ? (editedEmails.length / emailsSent) * 100 : 0;

  // Calculate average response time (created_at to sent_at)
  let totalResponseTimeMs = 0;
  let responseTimeCount = 0;

  sentLeads.forEach((lead) => {
    if (lead.status.sent_at && lead.status.received_at) {
      const sentTime = (lead.status.sent_at as any).toDate
        ? (lead.status.sent_at as any).toDate().getTime()
        : (lead.status.sent_at as Date).getTime();
      const receivedTime = (lead.status.received_at as any).toDate
        ? (lead.status.received_at as any).toDate().getTime()
        : (lead.status.received_at as Date).getTime();

      totalResponseTimeMs += sentTime - receivedTime;
      responseTimeCount++;
    }
  });

  const avgResponseTimeMs =
    responseTimeCount > 0 ? totalResponseTimeMs / responseTimeCount : 0;

  // Calculate average time to booking (sent_at to meeting_booked_at)
  let totalBookingTimeMs = 0;
  let bookingTimeCount = 0;

  const bookedLeads = leads.filter((lead) => {
    const data = lead as any;
    return data.meeting_booked_at;
  });
  bookedLeads.forEach((lead) => {
    const data = lead as any;
    if (data.meeting_booked_at && lead.status.sent_at) {
      const bookedTime = (data.meeting_booked_at as any).toDate
        ? (data.meeting_booked_at as any).toDate().getTime()
        : (data.meeting_booked_at as Date).getTime();
      const sentTime = (lead.status.sent_at as any).toDate
        ? (lead.status.sent_at as any).toDate().getTime()
        : (lead.status.sent_at as Date).getTime();

      totalBookingTimeMs += bookedTime - sentTime;
      bookingTimeCount++;
    }
  });

  const avgTimeToBookingMs =
    bookingTimeCount > 0 ? totalBookingTimeMs / bookingTimeCount : null;

  // Calculate rerouted count (manually forwarded leads - terminal state is forwarded)
  const reroutedCount = leads.filter((lead) => {
    const terminalState = getTerminalState(lead);
    return terminalState === "forwarded_support" || terminalState === "forwarded_account_team";
  }).length;

  // Calculate classification breakdown
  const { getCurrentClassification } = await import('./types');
  const classificationBreakdown = {
    "high-quality": leads.filter((l) => getCurrentClassification(l) === "high-quality").length,
    "low-quality": leads.filter((l) => getCurrentClassification(l) === "low-quality").length,
    support: leads.filter((l) => getCurrentClassification(l) === "support").length,
    duplicate: leads.filter((l) => getCurrentClassification(l) === "duplicate").length,
    irrelevant: leads.filter((l) => getCurrentClassification(l) === "irrelevant").length,
  };

  // Get time range
  const sortedLeads = leads.sort((a, b) => {
    const aTime = (a.status.received_at as any).toDate
      ? (a.status.received_at as any).toDate().getTime()
      : (a.status.received_at as Date).getTime();
    const bTime = (b.status.received_at as any).toDate
      ? (b.status.received_at as any).toDate().getTime()
      : (b.status.received_at as Date).getTime();
    return aTime - bTime;
  });

  const firstLeadAt = sortedLeads.length > 0 ? sortedLeads[0].status.received_at : null;
  const lastLeadAt =
    sortedLeads.length > 0 ? sortedLeads[sortedLeads.length - 1].status.received_at : null;

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
  // With single configuration, just return metrics for the system
  const configurationMetrics = await calculateConfigurationMetrics('system');
  return [configurationMetrics];
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

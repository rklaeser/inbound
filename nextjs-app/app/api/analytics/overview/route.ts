// GET /api/analytics/overview
// Get analytics overview based on the new data model

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firestore-admin";
import type { Lead, Classification } from "@/lib/types";
import { getTerminalState, getCurrentClassification, wasReclassified } from "@/lib/types";

interface AnalyticsData {
  totalLeads: number;
  leadsInReview: number;
  leadsDone: number;

  sentMeetingOffer: number;
  sentGeneric: number;
  forwardedSupport: number;
  forwardedAccountTeam: number;
  dead: number;

  classificationBreakdown: {
    'high-quality': number;
    'low-quality': number;
    support: number;
    duplicate: number;
    irrelevant: number;
  };

  autoSendRate: number;
  humanOverrideRate: number;
  botAccuracy: number;

  avgConfidence: number;
  confidenceByClassification: {
    classification: string;
    avgConfidence: number;
    count: number;
  }[];

  avgProcessingTimeMs: number;
  avgTimeToSendMs: number;
  avgTimeToMeetingMs: number;
  meetingsBooked: number;
}

export async function GET() {
  try {
    // Fetch all leads
    const leadsSnapshot = await adminDb.collection("leads").get();

    const leads: Lead[] = leadsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Lead));

    if (leads.length === 0) {
      return NextResponse.json({
        success: true,
        analytics: null,
      });
    }

    // Basic counts
    const totalLeads = leads.length;
    const leadsInReview = leads.filter((l) => l.status?.status === "review").length;
    const leadsDone = leads.filter((l) => l.status?.status === "done").length;

    // Terminal state counts
    let sentMeetingOffer = 0;
    let sentGeneric = 0;
    let forwardedSupport = 0;
    let forwardedAccountTeam = 0;
    let dead = 0;

    leads.forEach((lead) => {
      const terminalState = getTerminalState(lead);
      switch (terminalState) {
        case "sent_meeting_offer":
          sentMeetingOffer++;
          break;
        case "sent_generic":
          sentGeneric++;
          break;
        case "forwarded_support":
          forwardedSupport++;
          break;
        case "forwarded_account_team":
          forwardedAccountTeam++;
          break;
        case "dead":
          dead++;
          break;
      }
    });

    // Classification breakdown (current classification)
    const classificationBreakdown: AnalyticsData["classificationBreakdown"] = {
      "high-quality": 0,
      "low-quality": 0,
      support: 0,
      duplicate: 0,
      irrelevant: 0,
    };

    leads.forEach((lead) => {
      const classification = getCurrentClassification(lead);
      if (classification && classification in classificationBreakdown) {
        classificationBreakdown[classification as keyof typeof classificationBreakdown]++;
      }
    });

    // Auto-send rate: leads that went straight to done with only bot classification
    const autoSentLeads = leads.filter((l) => {
      if (!l.classifications || l.classifications.length === 0) return false;
      return (
        l.classifications.length === 1 &&
        l.classifications[0].author === "bot" &&
        l.status?.status === "done"
      );
    });
    const autoSendRate = totalLeads > 0 ? (autoSentLeads.length / totalLeads) * 100 : 0;

    // Human override rate: leads where human reclassified
    const reclassifiedLeads = leads.filter((l) => wasReclassified(l));
    const humanOverrideRate = totalLeads > 0 ? (reclassifiedLeads.length / totalLeads) * 100 : 0;

    // Bot accuracy: on sampled (reviewed) leads, how often did bot get it right
    // Compare bot classification to final human classification
    const sampledLeads = reclassifiedLeads.filter(
      (l) => l.classifications && l.classifications.length >= 2
    );
    let botAccuracyMatches = 0;
    sampledLeads.forEach((lead) => {
      // classifications[0] is the human (most recent), classifications[1] is the bot
      const humanClassification = lead.classifications[0].classification;
      const botClassification = lead.classifications[1].classification;
      if (humanClassification === botClassification) {
        botAccuracyMatches++;
      }
    });
    const botAccuracy = sampledLeads.length > 0 ? (botAccuracyMatches / sampledLeads.length) * 100 : 100;

    // Confidence stats
    const leadsWithConfidence = leads.filter((l) => l.bot_research?.confidence !== undefined);
    const avgConfidence =
      leadsWithConfidence.length > 0
        ? leadsWithConfidence.reduce((sum, l) => sum + (l.bot_research?.confidence || 0), 0) /
          leadsWithConfidence.length
        : 0;

    // Group by bot classification for confidence breakdown
    const confidenceByClassification: AnalyticsData["confidenceByClassification"] = [];
    const classificationGroups = new Map<Classification, { totalConfidence: number; count: number }>();

    leadsWithConfidence.forEach((lead) => {
      if (!lead.bot_research) return;
      const cls = lead.bot_research.classification;
      const existing = classificationGroups.get(cls) || { totalConfidence: 0, count: 0 };
      existing.totalConfidence += lead.bot_research.confidence;
      existing.count++;
      classificationGroups.set(cls, existing);
    });

    classificationGroups.forEach((data, classification) => {
      confidenceByClassification.push({
        classification,
        avgConfidence: data.count > 0 ? data.totalConfidence / data.count : 0,
        count: data.count,
      });
    });

    // Sort by count descending
    confidenceByClassification.sort((a, b) => b.count - a.count);

    // Timing metrics
    let totalProcessingTime = 0;
    let processingTimeCount = 0;
    let totalTimeToSend = 0;
    let timeToSendCount = 0;
    let totalTimeToMeeting = 0;
    let timeToMeetingCount = 0;

    leads.forEach((lead) => {
      // Processing time: received_at to bot_research.timestamp
      if (lead.status?.received_at && lead.bot_research?.timestamp) {
        const receivedAt = toDate(lead.status.received_at);
        const processedAt = toDate(lead.bot_research.timestamp);
        if (receivedAt && processedAt) {
          totalProcessingTime += processedAt.getTime() - receivedAt.getTime();
          processingTimeCount++;
        }
      }

      // Time to send: received_at to sent_at
      if (lead.status?.received_at && lead.status?.sent_at) {
        const receivedAt = toDate(lead.status.received_at);
        const sentAt = toDate(lead.status.sent_at);
        if (receivedAt && sentAt) {
          totalTimeToSend += sentAt.getTime() - receivedAt.getTime();
          timeToSendCount++;
        }
      }

      // Time to meeting: sent_at to meeting_booked_at
      const leadData = lead as Lead & { meeting_booked_at?: unknown };
      if (lead.status?.sent_at && leadData.meeting_booked_at) {
        const sentAt = toDate(lead.status.sent_at);
        const bookedAt = toDate(leadData.meeting_booked_at);
        if (sentAt && bookedAt) {
          totalTimeToMeeting += bookedAt.getTime() - sentAt.getTime();
          timeToMeetingCount++;
        }
      }
    });

    const avgProcessingTimeMs =
      processingTimeCount > 0 ? Math.round(totalProcessingTime / processingTimeCount) : 0;
    const avgTimeToSendMs =
      timeToSendCount > 0 ? Math.round(totalTimeToSend / timeToSendCount) : 0;
    const avgTimeToMeetingMs =
      timeToMeetingCount > 0 ? Math.round(totalTimeToMeeting / timeToMeetingCount) : 0;

    const analytics: AnalyticsData = {
      totalLeads,
      leadsInReview,
      leadsDone,
      sentMeetingOffer,
      sentGeneric,
      forwardedSupport,
      forwardedAccountTeam,
      dead,
      classificationBreakdown,
      autoSendRate: Math.round(autoSendRate * 100) / 100,
      humanOverrideRate: Math.round(humanOverrideRate * 100) / 100,
      botAccuracy: Math.round(botAccuracy * 100) / 100,
      avgConfidence,
      confidenceByClassification,
      avgProcessingTimeMs,
      avgTimeToSendMs,
      avgTimeToMeetingMs,
      meetingsBooked: timeToMeetingCount,
    };

    return NextResponse.json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error("Error fetching analytics overview:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch analytics overview",
      },
      { status: 500 }
    );
  }
}

// Helper to convert Firestore Timestamp or Date to JS Date
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && "toDate" in value && typeof (value as any).toDate === "function") {
    return (value as any).toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value);
  }
  return null;
}

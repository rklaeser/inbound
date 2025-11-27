import {
  leadResearcher,
  qualifyLead,
  generateEmailForLead,
} from '@/lib/workflow-services';
import { LeadFormData, Classification, ClassificationResult, BotText, LeadStatus } from '@/lib/types';
import { getConfiguration, getThresholdForClassification, shouldAutoSend } from '@/lib/configuration-helpers';

/**
 * Research result type
 */
export interface ResearchResult {
  report: string;
}

/**
 * Research step - gather lead information
 * Uses AI Agent with tools to collect comprehensive background data
 */
export const stepResearch = async (lead: LeadFormData): Promise<ResearchResult> => {
  'use step';

  console.log(`[Workflow] Starting research for lead: ${lead.company}`);

  // Run research agent
  const { text: research } = await leadResearcher.generate({
    prompt: `Research this inbound lead:
- Name: ${lead.name}
- Email: ${lead.email}
- Company: ${lead.company}
- Message: ${lead.message}

Provide a comprehensive research report.`
  });

  console.log(`[Workflow] Research completed`);

  return { report: research };
};

/**
 * Classification step - classify lead type
 * Analyzes lead data to determine classification category and confidence score
 */
export const stepClassify = async (
  lead: LeadFormData,
  research: ResearchResult
): Promise<ClassificationResult> => {
  'use step';

  console.log(`[Workflow] Starting classification`);

  // Run AI classification
  const qualification = await qualifyLead(lead, research.report);

  console.log(
    `[Workflow] Classification completed: ${qualification.classification} (confidence: ${qualification.confidence})`
  );

  return qualification;
};

/**
 * Email generation step - create personalized high-quality email
 * Only called for high-quality leads; other classifications use static templates
 */
export const stepGenerateEmail = async (
  lead: LeadFormData,
  research: ResearchResult,
  classification: ClassificationResult
): Promise<BotText> => {
  'use step';

  console.log(`[Workflow] Generating personalized email for high-quality lead`);

  // High-quality email: personalized from SDR with meeting offer
  const highQualityEmail = await generateEmailForLead(lead, research.report, classification);

  console.log(`[Workflow] Email generation completed`);

  return {
    highQualityText: highQualityEmail.body,
    lowQualityText: null,
  };
};

/**
 * Status determination step
 * Determines whether lead needs review or can auto-act based on:
 * 1. Confidence vs threshold for the classification type
 * 2. Rollout settings (enabled + percentage)
 */
export const stepDetermineStatus = async (
  classification: Classification,
  confidence: number
): Promise<{
  needs_review: boolean;
  applied_threshold: number;
  status: LeadStatus;
  sent_at: Date | null;
  sent_by: string | null;
}> => {
  'use step';

  console.log(`[Workflow] Determining status for ${classification} with confidence ${confidence}`);

  // Get configuration
  const config = await getConfiguration();

  // Get threshold for this classification type
  const threshold = getThresholdForClassification(config, classification);

  // Determine if needs review (confidence < threshold)
  const needs_review = confidence < threshold;

  // Determine if should auto-send
  const autoSend = !needs_review && shouldAutoSend(confidence, threshold, config.rollout);

  // Determine status
  let status: LeadStatus = 'review';
  let sent_at: Date | null = null;
  let sent_by: string | null = null;

  if (autoSend) {
    // Auto-send: mark as done immediately
    status = 'done';
    sent_at = new Date();
    sent_by = 'bot';
    console.log(
      `[Workflow] Auto-sending: confidence ${confidence} >= threshold ${threshold}, rollout passed`
    );
  } else if (needs_review) {
    console.log(
      `[Workflow] Needs review: confidence ${confidence} < threshold ${threshold}`
    );
  } else {
    // Passed threshold but didn't pass rollout - still goes to review
    console.log(
      `[Workflow] Rollout check failed: confidence ${confidence} >= threshold ${threshold}, but rollout blocked`
    );
  }

  return {
    needs_review,
    applied_threshold: threshold,
    status,
    sent_at,
    sent_by,
  };
};

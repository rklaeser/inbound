import {
  leadResearcher,
  qualifyLead,
  generateEmailForLead,
} from '@/lib/workflow-services';
import { LeadFormData, Classification, ClassificationResult, LeadStatus, Configuration } from '@/lib/types';
import { getThresholdForClassification, shouldAutoSend } from '@/lib/configuration-helpers';

/**
 * Research step - gather lead information
 * Uses AI Agent with tools to collect comprehensive background data
 * Case studies are discovered by the research agent's findCaseStudies tool
 */
export const stepResearch = async (lead: LeadFormData): Promise<string> => {
  'use step';

  console.log(`[Workflow] Starting research for lead: ${lead.company}`);

  // Run research agent - it will call findCaseStudies tool internally
  const { text: research } = await leadResearcher.generate({
    prompt: `Research this inbound lead:
- Name: ${lead.name}
- Email: ${lead.email}
- Company: ${lead.company}
- Message: ${lead.message}

Provide a comprehensive research report.`
  });

  console.log(`[Workflow] Research completed`);

  return research;
};

/**
 * Classification step - classify lead type using AI
 * Note: Duplicate detection happens before the workflow starts (in submit route)
 */
export const stepClassify = async (
  lead: LeadFormData,
  research: string
): Promise<ClassificationResult> => {
  'use step';

  console.log(`[Workflow] Starting classification`);

  // Run AI classification
  const qualification = await qualifyLead(lead, research);

  console.log(
    `[Workflow] Classification completed: ${qualification.classification} (confidence: ${qualification.confidence})`
  );

  return qualification;
};

/**
 * Email generation result type
 */
export interface EmailGenerationResult {
  body: string;
  includedCaseStudies: string[]; // Company names mentioned in the email
}

/**
 * Email generation step - create personalized high-quality email
 * Only called for high-quality leads; other classifications use static templates
 * Returns the email body and which case studies were mentioned
 */
export const stepGenerateEmail = async (
  lead: LeadFormData,
  research: string,
  classification: ClassificationResult
): Promise<EmailGenerationResult> => {
  'use step';

  console.log(`[Workflow] Generating personalized email for high-quality lead`);

  // High-quality email: personalized from SDR with meeting offer
  const result = await generateEmailForLead(lead);

  console.log(`[Workflow] Email generation completed, included case studies: ${result.includedCaseStudies.join(', ')}`);

  return {
    body: result.body,
    includedCaseStudies: result.includedCaseStudies,
  };
};

/**
 * Config subset needed for status determination
 * Passed in from API route (workflow runtime lacks setTimeout for Firebase)
 */
type StatusConfig = {
  thresholds: Configuration['thresholds'];
  rollout: Configuration['rollout'];
  allowHighQualityAutoSend: boolean;
};

/**
 * Status determination step
 * Determines whether lead needs review or can auto-act based on:
 * 1. Confidence vs threshold for the classification type
 * 2. Rollout settings (enabled + percentage)
 */
export const stepDetermineStatus = async (
  classification: Classification,
  confidence: number,
  config: StatusConfig
): Promise<{
  needs_review: boolean;
  applied_threshold: number;
  status: LeadStatus;
  sent_at: Date | null;
  sent_by: string | null;
}> => {
  'use step';

  console.log(`[Workflow] Determining status for ${classification} with confidence ${confidence}`);

  // Get threshold for this classification type (using passed-in config)
  const threshold = getThresholdForClassification(config as Configuration, classification);

  // Determine if needs review (confidence < threshold)
  const needs_review = confidence < threshold;

  // Determine if should auto-send
  // High-quality leads require allowHighQualityAutoSend to be enabled
  let autoSend = !needs_review && shouldAutoSend(confidence, threshold, config.rollout);

  if (classification === 'high-quality' && !config.allowHighQualityAutoSend) {
    autoSend = false;
    console.log(`[Workflow] High-quality auto-send disabled - requires human review`);
  }

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

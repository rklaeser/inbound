import { LeadFormData, Classification, BotResearch, BotText, LeadStatus } from '@/lib/types';
import {
  stepResearch,
  stepClassify,
  stepGenerateEmail,
  stepDetermineStatus
} from './steps';

/**
 * Result type returned by the workflow
 */
export interface WorkflowResult {
  // Bot research output
  bot_research: BotResearch;

  // Bot generated email text (both versions for flexibility)
  bot_text: BotText | null;

  // Whether lead needs review or can auto-send
  needs_review: boolean;

  // Threshold that was applied for this classification
  applied_threshold: number;

  // Initial status (review or done if auto-send)
  status: LeadStatus;

  // For auto-send: timestamp when sent
  sent_at: Date | null;

  // Who sent the email: "bot" for auto-send, null if not sent yet
  sent_by: string | null;
}

/**
 * Main workflow for processing inbound leads
 *
 * Flow:
 * 1. Research - AI Agent gathers comprehensive information
 * 2. Classify - AI classifies lead type with confidence score
 * 3. Generate Emails - AI creates email drafts (high-quality and low-quality versions)
 * 4. Determine Status - Based on confidence vs threshold and rollout settings
 *
 * Returns all results for the API route to persist to database
 */
export const workflowInbound = async (data: LeadFormData): Promise<WorkflowResult> => {
  'use workflow';

  console.log(`[Workflow] Starting inbound workflow for ${data.company}`);

  // Step 1: Research the lead
  const research = await stepResearch(data);

  // Step 2: Classify the lead
  const classification = await stepClassify(data, research);

  // Build bot_research object
  const bot_research: BotResearch = {
    timestamp: new Date(),
    confidence: classification.confidence,
    classification: classification.classification,
    reasoning: classification.reasoning,
  };

  // Step 3: Generate email for high-quality leads only
  // Other classifications use static templates or don't need emails
  let bot_text: BotText | null = null;
  if (classification.classification === 'high-quality') {
    bot_text = await stepGenerateEmail(data, research, classification);
  } else {
    console.log(
      `[Workflow] Skipping email generation for ${classification.classification} lead (uses static template or no email)`
    );
  }

  // Step 4: Determine status (review vs done)
  const { needs_review, applied_threshold, status, sent_at, sent_by } = await stepDetermineStatus(
    classification.classification,
    classification.confidence
  );

  console.log(`[Workflow] Workflow completed: status=${status}, needs_review=${needs_review}`);

  return {
    bot_research,
    bot_text,
    needs_review,
    applied_threshold,
    status,
    sent_at,
    sent_by,
  };
};

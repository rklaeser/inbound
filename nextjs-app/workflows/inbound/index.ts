import { LeadFormData, Classification, BotResearch, LeadStatus, MatchedCaseStudy, Configuration } from '@/lib/types';
import { type CaseStudy } from '@/lib/case-studies';
import {
  stepResearch,
  stepClassify,
  stepGenerateEmail,
  stepDetermineStatus,
  stepMatchCaseStudies,
  stepPersistResults,
  type ResearchResult
} from './steps';

/**
 * Email template config needed for email assembly in workflow
 */
export interface EmailTemplateConfig {
  greeting: string;
  callToAction: string;
  signOff: string;
  senderName: string;
  senderLastName: string;
  senderEmail: string;
  senderTitle: string;
}

/**
 * Input type for the workflow
 * All data that requires Firebase must be passed in (workflow runtime can't fetch config)
 */
export interface WorkflowInput {
  lead: LeadFormData;
  caseStudies: CaseStudy[];
  config: {
    thresholds: Configuration['thresholds'];
    rollout: Configuration['rollout'];
    allowHighQualityAutoSend: boolean;
    experimentalCaseStudies: boolean; // Whether case studies feature is enabled
  };
  // Context for persisting results
  leadId: string;
  useAIClassification: boolean;  // Whether AI classification is authoritative
  emailTemplateConfig: EmailTemplateConfig;  // For assembling emails in persist step
}

/**
 * Result type returned by the workflow
 */
export interface WorkflowResult {
  // Bot research output
  bot_research: BotResearch;

  // Email body text (just the personalized middle part, null for non-high-quality leads)
  // The submit route will assemble this into a full email with greeting/CTA/signature
  emailBody: string | null;

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

  // Case studies for customer-facing display (manually added by SDRs, not extracted from emails)
  matched_case_studies: MatchedCaseStudy[];
}

/**
 * Main workflow for processing inbound leads
 *
 * Note: Duplicate detection happens BEFORE this workflow is called (in the submit route).
 * This workflow only processes non-duplicate leads.
 *
 * Flow:
 * 1. Research - AI Agent gathers comprehensive information
 * 2. Classify - AI classifies lead type with confidence score
 * 3. Generate Emails - AI creates email drafts (for high-quality leads)
 * 4. Determine Status - Based on confidence vs threshold and rollout settings
 *
 * Returns all results for the API route to persist to database
 */
export const workflowInbound = async (input: WorkflowInput): Promise<WorkflowResult> => {
  'use workflow';

  const { lead: data, config, leadId, useAIClassification, emailTemplateConfig } = input;
  console.log(`[Workflow] Starting inbound workflow for ${data.company}`);

  // Step 1: Research the lead
  const research = await stepResearch(data);

  // Step 1.5: Match case studies (only if feature is enabled AND industry was found)
  // Skip entirely if no industry - don't even call the step
  let matched_case_studies: MatchedCaseStudy[] = [];
  if (config.experimentalCaseStudies && research.industry) {
    matched_case_studies = await stepMatchCaseStudies(data, research, true);
  } else if (!research.industry) {
    console.log(`[Workflow] Skipping case study matching - no industry found in research`);
  }

  // Step 2: Classify the lead
  const classification = await stepClassify(data, research);

  // Build bot_research object
  const bot_research: BotResearch = {
    timestamp: new Date(),
    confidence: classification.confidence,
    classification: classification.classification,
    reasoning: classification.reasoning,
    existingCustomer: classification.existingCustomer,
    researchReport: research.report,
  };

  // Step 3: Generate email for high-quality leads only
  // Other classifications use static templates or don't need emails
  let emailBody: string | null = null;

  if (classification.classification === 'high-quality') {
    const emailResult = await stepGenerateEmail(data, research, classification);

    // Return just the body - submit route will assemble full email
    emailBody = emailResult.body;
    console.log(`[Workflow] Generated email body for ${data.name}`);
  } else {
    console.log(
      `[Workflow] Skipping email generation for ${classification.classification} lead (uses static template or no email)`
    );
  }

  // Step 4: Determine status (review vs done)
  const { needs_review, applied_threshold, status, sent_at, sent_by } = await stepDetermineStatus(
    classification.classification,
    classification.confidence,
    config
  );

  const result: WorkflowResult = {
    bot_research,
    emailBody,
    needs_review,
    applied_threshold,
    status,
    sent_at,
    sent_by,
    matched_case_studies,
  };

  // Step 5: Persist results to database using firebase-admin
  // Pass full lead submission for eval context
  await stepPersistResults(leadId, result, useAIClassification, {
    name: data.name,
    email: data.email,
    company: data.company,
    message: data.message,
  }, emailTemplateConfig);

  console.log(`[Workflow] Workflow completed: status=${status}, needs_review=${needs_review}`);

  return result;
};

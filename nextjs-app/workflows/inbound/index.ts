import { LeadFormData, Classification, BotResearch, LeadStatus, MatchedCaseStudy, Configuration } from '@/lib/types';
import { type CaseStudy } from '@/lib/case-studies';
import {
  stepResearch,
  stepClassify,
  stepGenerateEmail,
  stepDetermineStatus
} from './steps';

/**
 * Input type for the workflow
 * All data that requires Firebase must be passed in (workflow runtime lacks setTimeout)
 */
export interface WorkflowInput {
  lead: LeadFormData;
  caseStudies: CaseStudy[];
  config: {
    thresholds: Configuration['thresholds'];
    rollout: Configuration['rollout'];
    allowHighQualityAutoSend: boolean;
  };
}

/**
 * Look up full case study data for company names mentioned in email
 * Uses pre-fetched case studies (no Firestore call - workflow runtime lacks setTimeout)
 */
function getCaseStudiesForCompanies(companyNames: string[], allCaseStudies: CaseStudy[]): MatchedCaseStudy[] {
  const result: MatchedCaseStudy[] = [];
  for (const name of companyNames) {
    const cs = allCaseStudies.find(c => c.company.toLowerCase() === name.toLowerCase());
    if (cs) {
      result.push({
        caseStudyId: cs.id,
        company: cs.company,
        industry: cs.industry,
        url: cs.url,
        matchType: 'mentioned',
        matchReason: 'Mentioned in email',
        logoSvg: cs.logoSvg,
        featuredText: cs.featuredText,
      });
    }
  }
  return result;
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

  // Case studies mentioned in the email for customer-facing display
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

  const { lead: data, caseStudies, config } = input;
  console.log(`[Workflow] Starting inbound workflow for ${data.company}`);

  // Step 1: Research the lead (agent discovers case studies via findCaseStudies tool)
  const research = await stepResearch(data);

  // Step 2: Classify the lead
  const classification = await stepClassify(data, research);

  // Build bot_research object
  const bot_research: BotResearch = {
    timestamp: new Date(),
    confidence: classification.confidence,
    classification: classification.classification,
    reasoning: classification.reasoning,
    existingCustomer: classification.existingCustomer,
    researchReport: research,
  };

  // Step 3: Generate email for high-quality leads only
  // Other classifications use static templates or don't need emails
  let emailBody: string | null = null;
  let matched_case_studies: MatchedCaseStudy[] = [];

  if (classification.classification === 'high-quality') {
    const emailResult = await stepGenerateEmail(data, research, classification);

    // Look up full case study data for companies mentioned in email
    matched_case_studies = getCaseStudiesForCompanies(emailResult.includedCaseStudies, caseStudies);
    console.log(`[Workflow] Email mentions ${matched_case_studies.length} case studies: ${emailResult.includedCaseStudies.join(', ')}`);

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

  console.log(`[Workflow] Workflow completed: status=${status}, needs_review=${needs_review}`);

  return {
    bot_research,
    emailBody,
    needs_review,
    applied_threshold,
    status,
    sent_at,
    sent_by,
    matched_case_studies,
  };
};

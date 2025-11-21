import { LeadFormData, ClassificationResult, EmailGenerationResult } from '@/lib/types';
import {
  stepResearch,
  stepQualify,
  stepGenerateEmail,
  stepDetermineAutonomyAndOutcome
} from './steps';

/**
 * Result type returned by the workflow
 */
export interface WorkflowResult {
  research: {
    report: string;
    jobTitle: string | null;
    linkedinUrl: string | null;
  };
  qualification: ClassificationResult;
  email: EmailGenerationResult | null;
  autonomy: 'review' | 'auto';
  outcome: 'pending' | 'dead' | 'forwarded';
}

/**
 * Main workflow for processing inbound leads
 *
 * Flow:
 * 1. Research - AI Agent gathers comprehensive information
 * 2. Qualify - AI classifies lead quality
 * 3. Generate Email - AI creates personalized response (for quality leads)
 * 4. Determine Autonomy & Outcome - Determine if auto-action or review needed, and what outcome
 *
 * Returns all results for the API route to persist to database
 */
export const workflowInbound = async (data: LeadFormData): Promise<WorkflowResult> => {
  'use workflow';

  console.log(`[Workflow] Starting inbound workflow for ${data.company}`);

  // Step 1: Research the lead
  const research = await stepResearch(data);

  // Step 2: Qualify the lead
  const qualification = await stepQualify(data, research.report);

  // Step 3: Generate email for relevant leads
  // Generate emails for quality, uncertain, support, and low-value leads
  // Skip email for irrelevant, dead, and duplicate leads
  let email: EmailGenerationResult | null = null;
  if (
    qualification.classification === 'quality' ||
    qualification.classification === 'uncertain' ||
    qualification.classification === 'support' ||
    qualification.classification === 'low-value'
  ) {
    email = await stepGenerateEmail(data, research.report, qualification);
  } else {
    console.log(
      `[Workflow] Skipping email generation for ${qualification.classification} lead`
    );
  }

  // Step 4: Determine autonomy and outcome
  const { autonomy, outcome } = await stepDetermineAutonomyAndOutcome(qualification);

  console.log(`[Workflow] Workflow completed with autonomy: ${autonomy}, outcome: ${outcome}`);

  return {
    research,
    qualification,
    email,
    autonomy,
    outcome
  };
};

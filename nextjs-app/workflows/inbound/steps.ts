import {
  leadResearcher,
  qualifyLead,
  generateEmailForLead,
} from '@/lib/workflow-services';
import { LeadFormData, Classification, ClassificationResult, LeadStatus, Configuration, MatchedCaseStudy } from '@/lib/types';
import { getThresholdForClassification, shouldAutoSend } from '@/lib/configuration-helpers';
import { findRelevantCaseStudiesVectorWithReason, type Industry } from '@/lib/case-studies';
import { caseStudyToMatchedCaseStudy } from '@/lib/email';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

/**
 * Research result with structured data
 */
export interface ResearchResult {
  report: string;
  industry: Industry | null;
}

/**
 * Research step - gather lead information
 * Uses AI Agent with tools to collect comprehensive background data
 * Returns structured data including the research report and extracted industry
 */
export const stepResearch = async (lead: LeadFormData): Promise<ResearchResult> => {
  'use step';

  console.log(`[Workflow] Starting research for lead: ${lead.company}`);

  // Run research agent to gather company and person information
  const { text: researchText } = await leadResearcher.generate({
    prompt: `Research this inbound lead:
- Name: ${lead.name}
- Email: ${lead.email}
- Company: ${lead.company}
- Message: ${lead.message}

Provide a comprehensive research report.`
  });

  console.log(`[Workflow] Research completed, extracting industry...`);

  // Extract industry from research text using AI
  const industrySchema = z.object({
    industry: z.enum([
      'AI',
      'Software',
      'Retail',
      'Business Services',
      'Finance & Insurance',
      'Media',
      'Healthcare',
      'Energy & Utilities',
    ]).nullable().describe('The industry extracted from the research report, or null if not found or unclear'),
  });

  const { object: industryResult } = await generateObject({
    model: openai('gpt-4o'),
    schema: industrySchema,
    prompt: `Extract the industry from this research report. Look for the "Industry:" field in the Company section.

RESEARCH REPORT:
${researchText}

If the industry is listed as "Unknown" or not found, return null. Otherwise, return the industry value matching one of the available industries.`,
  });

  const industry = industryResult.industry;

  if (industry) {
    console.log(`[Workflow] Extracted industry from research: ${industry}`);
  } else {
    console.log(`[Workflow] No industry found in research report`);
  }

  return {
    report: researchText,
    industry,
  };
};

/**
 * Classification step - classify lead type using AI
 * Note: Duplicate detection happens before the workflow starts (in submit route)
 */
export const stepClassify = async (
  lead: LeadFormData,
  research: ResearchResult
): Promise<ClassificationResult> => {
  'use step';

  console.log(`[Workflow] Starting classification`);

  // Run AI classification using the research report text
  const qualification = await qualifyLead(lead, research.report);

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
 * Match case studies step - finds relevant case studies for the lead
 * Only runs if experimental.caseStudies is enabled and research provides an industry
 * Returns matched case studies with matchType and matchReason
 */
export const stepMatchCaseStudies = async (
  lead: LeadFormData,
  research: ResearchResult,
  enabled: boolean
): Promise<MatchedCaseStudy[]> => {
  'use step';

  if (!enabled) {
    return [];
  }

  // Industry should be checked before calling this step, but double-check for safety
  if (!research.industry) {
    console.log(`[Workflow] Warning: stepMatchCaseStudies called without industry`);
    return [];
  }

  console.log(`[Workflow] Matching case studies for ${lead.company} (industry: ${research.industry})`);

  // Use RAG-based vector search to find the most relevant case study
  // Industry is included in the query to boost industry matches
  const vectorMatches = await findRelevantCaseStudiesVectorWithReason(
    { company: lead.company, message: lead.message },
    1, // Return only 1 case study
    research.industry
  );

  // Convert to MatchedCaseStudy format
  const matchedCaseStudies: MatchedCaseStudy[] = vectorMatches.map(match => {
    // Determine match type based on whether industry matches
    const matchType = research.industry && match.caseStudy.industry === research.industry
      ? 'industry'
      : 'problem';
    
    return caseStudyToMatchedCaseStudy(match.caseStudy, matchType, match.matchReason);
  });

  console.log(`[Workflow] Matched ${matchedCaseStudies.length} case study using RAG vector search`);

  return matchedCaseStudies;
};

/**
 * Email generation step - create personalized high-quality email
 * Only called for high-quality leads; other classifications use static templates
 * Returns the email body and which case studies were mentioned
 */
export const stepGenerateEmail = async (
  lead: LeadFormData,
  research: ResearchResult,
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

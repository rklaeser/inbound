import {
  leadResearcher,
  qualifyLead,
  generateEmailForLead,
  generateGenericEmail,
  generateLowValueEmail
} from '@/lib/workflow-services';
import { LeadFormData, ClassificationResult } from '@/lib/types';

/**
 * Research step - gather lead information
 * Uses AI Agent with tools to collect comprehensive background data
 */
export const stepResearch = async (lead: LeadFormData) => {
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

  // Extract job title and LinkedIn URL from research using regex
  const jobTitleMatch = research.match(/Job Title:\s*([^\n]+)/i);
  const linkedinMatch = research.match(/LinkedIn:\s*(https?:\/\/[^\s\)]+)/i);

  return {
    report: research,
    jobTitle: jobTitleMatch ? jobTitleMatch[1].trim() : null,
    linkedinUrl: linkedinMatch ? linkedinMatch[1].trim() : null,
  };
};

/**
 * Qualification step - classify lead quality
 * Analyzes lead data to determine classification category and confidence score
 */
export const stepQualify = async (
  lead: LeadFormData,
  research: string
) => {
  'use step';

  console.log(`[Workflow] Starting qualification`);

  // Run AI qualification
  const qualification = await qualifyLead(lead, research);

  console.log(
    `[Workflow] Qualification completed: ${qualification.classification} (${qualification.confidence})`
  );

  return qualification;
};

/**
 * Email generation step - create personalized response
 * Generates appropriate email based on lead classification
 *
 * Email types:
 * - Quality: Personalized from SDR with meeting offer
 * - Uncertain: Generic from Vercel with customers link
 * - Support: Generic from Vercel with customers link
 * - Low-value: Sales email from Vercel with customers link (no meeting offer)
 */
export const stepGenerateEmail = async (
  lead: LeadFormData,
  research: string,
  classification: ClassificationResult
) => {
  'use step';

  console.log(`[Workflow] Starting email generation`);

  // Determine which email type to generate based on classification
  let email;
  if (classification.classification === 'quality') {
    // Quality leads get personalized email from SDR with meeting offer
    console.log(`[Workflow] Generating personalized email for quality lead`);
    email = await generateEmailForLead(lead, research, classification);
  } else if (classification.classification === 'low-value') {
    // Low-value leads get sales email from Vercel with configurable CTA (no meeting offer)
    console.log(`[Workflow] Generating low-value sales email`);
    email = await generateLowValueEmail(lead);
  } else {
    // Uncertain and support leads get generic email from Vercel with customers link
    console.log(`[Workflow] Generating generic email for ${classification.classification} lead`);
    email = await generateGenericEmail(lead);
  }

  console.log(`[Workflow] Email generation completed`);

  return email;
};

/**
 * Step 4: Determine autonomy and outcome
 * Determines whether lead needs review or can be auto-processed
 * Based on classification type and confidence thresholds
 */
export const stepDetermineAutonomyAndOutcome = async (
  classification: ClassificationResult
) => {
  'use step';

  console.log(`[Workflow] Determining autonomy and outcome`);

  // Get configuration settings for auto-action thresholds
  const { getActiveConfiguration } = await import('@/lib/configuration-helpers');
  const configuration = await getActiveConfiguration();

  const autoDeadLowValueThreshold = configuration.settings.autoDeadLowValueThreshold;
  const autoDeadIrrelevantThreshold = configuration.settings.autoDeadIrrelevantThreshold;
  const autoForwardDuplicateThreshold = configuration.settings.autoForwardDuplicateThreshold;
  const autoForwardSupportThreshold = configuration.settings.autoForwardSupportThreshold;

  // Default: everything goes to review with pending outcome
  let autonomy: 'review' | 'auto' = 'review';
  let outcome: 'pending' | 'dead' | 'forwarded_account_team' | 'forwarded_support' = 'pending';

  // Check each classification type for auto-action eligibility

  // Duplicate: auto-forward to account team if confidence meets threshold
  if (classification.classification === 'duplicate') {
    if (classification.confidence >= autoForwardDuplicateThreshold) {
      autonomy = 'auto';
      outcome = 'forwarded_account_team';
      console.log(
        `[Workflow] Auto-forwarding duplicate to account team (confidence: ${classification.confidence} >= threshold: ${autoForwardDuplicateThreshold})`
      );
    } else {
      console.log(
        `[Workflow] Duplicate needs review (confidence: ${classification.confidence} < threshold: ${autoForwardDuplicateThreshold})`
      );
    }
  }

  // Support: auto-forward to support team if confidence meets threshold
  else if (classification.classification === 'support') {
    if (classification.confidence >= autoForwardSupportThreshold) {
      autonomy = 'auto';
      outcome = 'forwarded_support';
      console.log(
        `[Workflow] Auto-forwarding support request (confidence: ${classification.confidence} >= threshold: ${autoForwardSupportThreshold})`
      );
    } else {
      console.log(
        `[Workflow] Support request needs review (confidence: ${classification.confidence} < threshold: ${autoForwardSupportThreshold})`
      );
    }
  }

  // Low-value: auto-dead if confidence meets threshold (real opportunity but not a fit)
  else if (classification.classification === 'low-value') {
    if (classification.confidence >= autoDeadLowValueThreshold) {
      autonomy = 'auto';
      outcome = 'dead';
      console.log(
        `[Workflow] Auto-marking low-value as dead (confidence: ${classification.confidence} >= threshold: ${autoDeadLowValueThreshold})`
      );
    } else {
      console.log(
        `[Workflow] Low-value needs review (confidence: ${classification.confidence} < threshold: ${autoDeadLowValueThreshold})`
      );
    }
  }

  // Irrelevant: auto-dead if confidence meets threshold (spam, nonsense)
  else if (classification.classification === 'irrelevant') {
    if (classification.confidence >= autoDeadIrrelevantThreshold) {
      autonomy = 'auto';
      outcome = 'dead';
      console.log(
        `[Workflow] Auto-marking irrelevant as dead (confidence: ${classification.confidence} >= threshold: ${autoDeadIrrelevantThreshold})`
      );
    } else {
      console.log(
        `[Workflow] Irrelevant needs review (confidence: ${classification.confidence} < threshold: ${autoDeadIrrelevantThreshold})`
      );
    }
  }

  // Quality, uncertain, dead: always need review (no auto-action)
  else {
    console.log(
      `[Workflow] ${classification.classification} classification requires human review`
    );
  }

  console.log(`[Workflow] Autonomy: ${autonomy}, Outcome: ${outcome}`);

  return { autonomy, outcome };
};

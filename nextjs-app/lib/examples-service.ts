// Classification Examples Service
// CRUD operations for few-shot learning examples

import 'server-only';

import { adminDb } from './db';
import { serializeFirestoreData } from './db/utils';
import type { ClassificationExample, ExampleStatus, Classification } from './types';

const EXAMPLES_COLLECTION = 'examples';

/**
 * Create a classification example from a lead
 * @param leadId - Source lead ID
 * @param sdrReasoning - SDR's explanation of why this classification is correct
 * @param createdBy - SDR name who created the example
 */
export async function createExample(
  leadId: string,
  sdrReasoning: string,
  createdBy: string
): Promise<ClassificationExample> {
  // Fetch the lead to get snapshot data
  const leadDoc = await adminDb.collection('leads').doc(leadId).get();

  if (!leadDoc.exists) {
    throw new Error(`Lead ${leadId} not found`);
  }

  const leadData = leadDoc.data();
  if (!leadData) {
    throw new Error(`Lead ${leadId} has no data`);
  }

  // Ensure lead has classification
  if (!leadData.classifications || leadData.classifications.length === 0) {
    throw new Error(`Lead ${leadId} has no classification`);
  }

  const currentClassification = leadData.classifications[0].classification as Classification;
  const researchReport = leadData.bot_research?.researchReport || '';

  const now = new Date();
  const exampleData = {
    lead_snapshot: {
      submission: {
        leadName: leadData.submission.leadName,
        email: leadData.submission.email,
        company: leadData.submission.company,
        message: leadData.submission.message,
      },
      research_report: researchReport,
    },
    classification: currentClassification,
    sdr_reasoning: sdrReasoning,
    status: 'inactive' as ExampleStatus, // New examples start inactive
    source_lead_id: leadId,
    created_by: createdBy,
    created_at: now,
    updated_at: now,
  };

  const docRef = await adminDb.collection(EXAMPLES_COLLECTION).add(exampleData);

  return {
    id: docRef.id,
    ...exampleData,
  };
}

/**
 * Get all examples, ordered by created_at desc (newest first)
 */
export async function getExamples(): Promise<ClassificationExample[]> {
  const snapshot = await adminDb
    .collection(EXAMPLES_COLLECTION)
    .orderBy('created_at', 'desc')
    .get();

  return snapshot.docs.map(doc =>
    serializeFirestoreData<ClassificationExample>({
      id: doc.id,
      ...doc.data(),
    })
  );
}

/**
 * Update example status (activate/deactivate)
 */
export async function updateExampleStatus(
  id: string,
  status: ExampleStatus
): Promise<void> {
  await adminDb.collection(EXAMPLES_COLLECTION).doc(id).update({
    status,
    updated_at: new Date(),
  });
}

/**
 * Delete an example
 */
export async function deleteExample(id: string): Promise<void> {
  await adminDb.collection(EXAMPLES_COLLECTION).doc(id).delete();
}

/**
 * Get active examples for prompt injection
 * Returns max 5 examples, newest first
 */
export async function getActiveExamples(limit: number = 5): Promise<ClassificationExample[]> {
  const snapshot = await adminDb
    .collection(EXAMPLES_COLLECTION)
    .where('status', '==', 'active')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc =>
    serializeFirestoreData<ClassificationExample>({
      id: doc.id,
      ...doc.data(),
    })
  );
}

/**
 * Format examples for injection into classification prompt
 * Truncates research to keep token count manageable
 */
export function formatExamplesForPrompt(examples: ClassificationExample[]): string {
  if (examples.length === 0) {
    return '';
  }

  const MAX_RESEARCH_LENGTH = 500;

  const formattedExamples = examples.map((example, index) => {
    const truncatedResearch = example.lead_snapshot.research_report.length > MAX_RESEARCH_LENGTH
      ? example.lead_snapshot.research_report.slice(0, MAX_RESEARCH_LENGTH) + '...'
      : example.lead_snapshot.research_report;

    return `Example ${index + 1}:
Lead: ${example.lead_snapshot.submission.leadName} at ${example.lead_snapshot.submission.company}
Message: ${example.lead_snapshot.submission.message}
Research: ${truncatedResearch}
Classification: ${example.classification}
Why: ${example.sdr_reasoning}
---`;
  }).join('\n\n');

  return `VERIFIED EXAMPLES:

${formattedExamples}

`;
}

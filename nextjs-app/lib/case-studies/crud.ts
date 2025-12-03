// Case study CRUD operations using Firebase Admin SDK

import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../db';
import { generateEmbedding } from './embedding';
import { invalidateCaseStudyCache } from './cache';
import type { CaseStudy } from './types';

const COLLECTION_NAME = 'case_studies';

/**
 * Create searchable text from case study for embedding
 * Uses full_article_text if available for richer semantic matching
 */
function createCaseStudyText(caseStudy: Omit<CaseStudy, 'id'>): string {
  // Prefer full article text for better embedding quality
  if (caseStudy.full_article_text) {
    return caseStudy.full_article_text;
  }

  // Fallback to basic info if no full article text
  const parts: string[] = [];
  parts.push(`Company: ${caseStudy.company}`);
  parts.push(`Industry: ${caseStudy.industry}`);
  parts.push(`Featured: ${caseStudy.featuredText}`);

  return parts.join('. ');
}

/**
 * Get all case studies from Firebase
 */
export async function getAllCaseStudies(): Promise<CaseStudy[]> {
  const snapshot = await adminDb
    .collection(COLLECTION_NAME)
    .orderBy('company', 'asc')
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as CaseStudy));
}

/**
 * Get a single case study by ID
 */
export async function getCaseStudy(id: string): Promise<CaseStudy | null> {
  const doc = await adminDb.collection(COLLECTION_NAME).doc(id).get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as CaseStudy;
}

/**
 * Create a new case study
 */
export async function createCaseStudy(
  caseStudy: Omit<CaseStudy, 'id'>
): Promise<string> {
  // Generate embedding for the case study
  console.log(`[Case Studies] Generating embedding for ${caseStudy.company}...`);
  const text = createCaseStudyText(caseStudy);
  const embedding = await generateEmbedding(text);

  const docData = {
    ...caseStudy,
    embedding,
    embedding_model: 'text-embedding-3-small',
    embedding_generated_at: FieldValue.serverTimestamp(),
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };

  const docRef = await adminDb.collection(COLLECTION_NAME).add(docData);
  console.log(`[Case Studies] Created ${caseStudy.company} with embedding (ID: ${docRef.id})`);

  // Invalidate cache so new case study is available immediately
  invalidateCaseStudyCache();

  return docRef.id;
}

/**
 * Update an existing case study
 */
export async function updateCaseStudy(
  id: string,
  updates: Partial<Omit<CaseStudy, 'id'>>
): Promise<void> {
  const docRef = adminDb.collection(COLLECTION_NAME).doc(id);

  // Get the current case study to merge with updates
  const currentDoc = await docRef.get();
  if (!currentDoc.exists) {
    throw new Error('Case study not found');
  }

  const currentData = currentDoc.data()!;
  const mergedData = { ...currentData, ...updates };

  // Regenerate embedding if content changed
  const contentChanged =
    updates.company !== undefined ||
    updates.featuredText !== undefined ||
    updates.industry !== undefined ||
    updates.full_article_text !== undefined;

  let updateData: Record<string, unknown> = {
    ...updates,
    updated_at: FieldValue.serverTimestamp(),
  };

  if (contentChanged) {
    console.log(`[Case Studies] Content changed, regenerating embedding for ${mergedData.company}...`);
    const text = createCaseStudyText(mergedData as Omit<CaseStudy, 'id'>);
    const embedding = await generateEmbedding(text);

    updateData = {
      ...updateData,
      embedding,
      embedding_model: 'text-embedding-3-small',
      embedding_generated_at: FieldValue.serverTimestamp(),
    };
  }

  await docRef.update(updateData);

  // Invalidate cache so updates are available immediately
  invalidateCaseStudyCache();
}

/**
 * Delete a case study
 */
export async function deleteCaseStudy(id: string): Promise<void> {
  await adminDb.collection(COLLECTION_NAME).doc(id).delete();

  // Invalidate cache so deletion is reflected immediately
  invalidateCaseStudyCache();
}

/**
 * Validate case study data
 */
export function validateCaseStudy(data: Partial<CaseStudy>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.company?.trim()) {
    errors.push('Company name is required');
  }

  if (!data.industry) {
    errors.push('Industry is required');
  }

  if (!data.url?.trim()) {
    errors.push('URL is required');
  } else {
    try {
      new URL(data.url);
    } catch {
      errors.push('URL must be a valid URL');
    }
  }

  if (!data.products || data.products.length === 0) {
    errors.push('At least one Vercel product is required');
  }

  if (!data.logoSvg?.trim()) {
    errors.push('Logo SVG is required');
  }

  if (!data.featuredText?.trim()) {
    errors.push('Featured text is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

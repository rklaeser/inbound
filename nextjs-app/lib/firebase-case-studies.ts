import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from './firestore';
import { generateEmbedding } from './embedding-service';
import type { CaseStudy, Industry, VercelProduct } from './case-studies';
import { invalidateCaseStudyCache } from './case-study-matcher';

/**
 * Firebase document structure for case studies
 */
export interface CaseStudyDocument extends Omit<CaseStudy, 'id'> {
  // Embedding fields
  embedding?: number[];
  embedding_model?: string;
  embedding_generated_at?: Timestamp;

  // Timestamps
  created_at: Timestamp;
  updated_at: Timestamp;
}

/**
 * Create searchable text from case study for embedding
 */
function createCaseStudyText(caseStudy: Omit<CaseStudy, 'id'>): string {
  const parts: string[] = [];

  parts.push(`Company: ${caseStudy.company}`);
  parts.push(`Industry: ${caseStudy.industry}`);
  parts.push(`Technologies: ${caseStudy.products.join(', ')}`);
  parts.push(`Featured: ${caseStudy.featuredText}`);

  return parts.join('. ');
}

const COLLECTION_NAME = 'case_studies';

/**
 * Get all case studies from Firebase
 */
export async function getAllCaseStudies(): Promise<CaseStudy[]> {
  const caseStudiesRef = collection(db, COLLECTION_NAME);
  const q = query(caseStudiesRef, orderBy('company', 'asc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as CaseStudy));
}

/**
 * Get a single case study by ID
 */
export async function getCaseStudy(id: string): Promise<CaseStudy | null> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as CaseStudy;
}

/**
 * Create a new case study
 */
export async function createCaseStudy(
  caseStudy: Omit<CaseStudy, 'id'>
): Promise<string> {
  const caseStudiesRef = collection(db, COLLECTION_NAME);

  // Generate embedding for the case study
  console.log(`[Case Studies] Generating embedding for ${caseStudy.company}...`);
  const text = createCaseStudyText(caseStudy);
  const embedding = await generateEmbedding(text);

  const docData: CaseStudyDocument = {
    ...caseStudy,
    embedding,
    embedding_model: 'text-embedding-3-small',
    embedding_generated_at: Timestamp.now(),
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
  };

  const docRef = await addDoc(caseStudiesRef, docData);
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
  const docRef = doc(db, COLLECTION_NAME, id);

  // Get the current case study to merge with updates
  const currentDoc = await getDoc(docRef);
  if (!currentDoc.exists()) {
    throw new Error('Case study not found');
  }

  const currentData = currentDoc.data() as CaseStudyDocument;
  const mergedData = { ...currentData, ...updates };

  // Regenerate embedding if content changed
  const contentChanged =
    updates.company !== undefined ||
    updates.featuredText !== undefined ||
    updates.industry !== undefined ||
    updates.products !== undefined;

  let updateData: any = {
    ...updates,
    updated_at: Timestamp.now(),
  };

  if (contentChanged) {
    console.log(`[Case Studies] Content changed, regenerating embedding for ${mergedData.company}...`);
    const text = createCaseStudyText(mergedData as Omit<CaseStudy, 'id'>);
    const embedding = await generateEmbedding(text);

    updateData = {
      ...updateData,
      embedding,
      embedding_model: 'text-embedding-3-small',
      embedding_generated_at: Timestamp.now(),
    };
  }

  await updateDoc(docRef, updateData);

  // Invalidate cache so updates are available immediately
  invalidateCaseStudyCache();
}

/**
 * Delete a case study
 */
export async function deleteCaseStudy(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);

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

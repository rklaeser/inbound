// Server-side Firestore data fetching functions
// These use the Admin SDK and can only be called from Server Components or API routes

import 'server-only';

import { adminDb } from './firestore-admin';
import { serializeFirestoreData } from './firestore-utils';
import type { CaseStudy } from './case-studies';
import type { Lead } from './types';

// Re-export adminDb for use in other server-side files
export { adminDb };

/**
 * Get all case studies (server-side)
 * Can be cached with Next.js revalidate
 * Excludes embedding fields for performance
 */
export async function getAllCaseStudiesServer(): Promise<CaseStudy[]> {
  const caseStudiesRef = adminDb.collection('case_studies');
  const snapshot = await caseStudiesRef
    .orderBy('company', 'asc')
    .select('company', 'industry', 'description', 'metrics', 'products', 'url', 'quote', 'quotedPerson')
    .get();

  return snapshot.docs.map(doc =>
    serializeFirestoreData<CaseStudy>({
      id: doc.id,
      ...doc.data(),
    })
  );
}

/**
 * Get all leads (server-side)
 * Can be cached with Next.js revalidate
 */
export async function getAllLeadsServer(): Promise<Lead[]> {
  const leadsRef = adminDb.collection('leads');
  const snapshot = await leadsRef.orderBy('created_at', 'desc').get();

  return snapshot.docs.map(doc =>
    serializeFirestoreData<Lead>({
      id: doc.id,
      ...doc.data(),
    })
  );
}

/**
 * Get leads by status (server-side)
 */
export async function getLeadsByStatusServer(status: string): Promise<Lead[]> {
  const leadsRef = adminDb.collection('leads');
  const snapshot = await leadsRef
    .where('status', '==', status)
    .orderBy('created_at', 'desc')
    .get();

  return snapshot.docs.map(doc =>
    serializeFirestoreData<Lead>({
      id: doc.id,
      ...doc.data(),
    })
  );
}

/**
 * Get a single lead by ID (server-side)
 */
export async function getLeadByIdServer(id: string): Promise<Lead | null> {
  const leadRef = adminDb.collection('leads').doc(id);
  const doc = await leadRef.get();

  if (!doc.exists) {
    return null;
  }

  return serializeFirestoreData<Lead>({
    id: doc.id,
    ...doc.data(),
  });
}

/**
 * Get all configurations (server-side)
 */
export async function getAllConfigurationsServer() {
  const configurationsRef = adminDb.collection('configurations');
  const snapshot = await configurationsRef.orderBy('created_at', 'desc').get();

  return snapshot.docs.map(doc =>
    serializeFirestoreData({
      id: doc.id,
      ...doc.data(),
    })
  );
}

/**
 * Get leads in review queue (server-side)
 * New data model: status.status = 'review' means lead needs human action
 */
export async function getReviewQueueLeadsServer(): Promise<Lead[]> {
  const leadsRef = adminDb.collection('leads');

  const snapshot = await leadsRef
    .where('status.status', '==', 'review')
    .orderBy('status.received_at', 'desc')
    .get();

  return snapshot.docs.map(doc =>
    serializeFirestoreData<Lead>({
      id: doc.id,
      ...doc.data(),
    })
  );
}

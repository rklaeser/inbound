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
    .select('company', 'industry', 'products', 'url', 'logoSvg', 'featuredText')
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
 * Sorted: review leads first, then done leads, each by received_at desc
 */
export async function getAllLeadsServer(): Promise<Lead[]> {
  const leadsRef = adminDb.collection('leads');
  const snapshot = await leadsRef.orderBy('status.received_at', 'desc').get();

  const leads = snapshot.docs.map(doc =>
    serializeFirestoreData<Lead>({
      id: doc.id,
      ...doc.data(),
    })
  );

  // Sort: review leads first, then done leads, each by received_at desc
  const statusOrder: Record<string, number> = { review: 0, done: 1 };
  return leads.sort((a, b) => {
    const aStatusOrder = statusOrder[a.status?.status] ?? 2;
    const bStatusOrder = statusOrder[b.status?.status] ?? 2;
    if (aStatusOrder !== bStatusOrder) {
      return aStatusOrder - bStatusOrder;
    }
    // Within same status, sort by received_at desc
    const aTime = a.status?.received_at ? new Date(a.status.received_at as string | Date).getTime() : 0;
    const bTime = b.status?.received_at ? new Date(b.status.received_at as string | Date).getTime() : 0;
    return bTime - aTime;
  });
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

/**
 * Get a single case study by ID (server-side)
 */
export async function getCaseStudyByIdServer(id: string): Promise<CaseStudy | null> {
  const caseStudyRef = adminDb.collection('case_studies').doc(id);
  const doc = await caseStudyRef.get();

  if (!doc.exists) {
    return null;
  }

  return serializeFirestoreData<CaseStudy>({
    id: doc.id,
    ...doc.data(),
  });
}

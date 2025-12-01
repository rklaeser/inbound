// Database module - server-side re-exports
// For client components needing real-time listeners, import from '@/lib/db/client'

import 'server-only';

// Admin SDK
export { adminDb } from './admin';

// Server-side data fetching
export {
  getAllCaseStudiesServer,
  getAllLeadsServer,
  getLeadsByStatusServer,
  getLeadByIdServer,
  getReviewQueueLeadsServer,
  getCaseStudyByIdServer,
} from './server';

// Utilities
export { serializeFirestoreData, toDate, toMillis } from './utils';

// Storage
export { uploadCaseStudyLogo, deleteCaseStudyLogo } from './storage';

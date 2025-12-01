// Case studies module - server-side re-exports
// For client components, import directly from '@/lib/case-studies/types'

import 'server-only';

// Types (also available from ./types for client components)
export type { CaseStudy, Industry, VercelProduct } from './types';
export { INDUSTRIES, PRODUCTS } from './types';

// CRUD operations (server-only)
export {
  getAllCaseStudies,
  getCaseStudy,
  createCaseStudy,
  updateCaseStudy,
  deleteCaseStudy,
  validateCaseStudy,
} from './crud';

// Caching and industry normalization
export {
  getCachedCaseStudies,
  invalidateCaseStudyCache,
  normalizeIndustry,
} from './matcher';

// Vector-based matching
export type { CaseStudyVectorMatch } from './vector-matcher';
export {
  SIMILARITY_THRESHOLD,
  findRelevantCaseStudiesVectorWithReason,
} from './vector-matcher';

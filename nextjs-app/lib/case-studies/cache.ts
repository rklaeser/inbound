// Case study cache management

import type { CaseStudy } from './types';

/**
 * Module-level cache for case studies
 */
let cachedCaseStudies: CaseStudy[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached case studies if still valid
 */
export function getCachedData(): { data: CaseStudy[] | null; isValid: boolean } {
  const now = Date.now();
  const isValid = cachedCaseStudies !== null && (now - cacheTimestamp) < CACHE_TTL_MS;
  return { data: cachedCaseStudies, isValid };
}

/**
 * Set cache with new data
 */
export function setCacheData(data: CaseStudy[]): void {
  cachedCaseStudies = data;
  cacheTimestamp = Date.now();
}

/**
 * Invalidate cache - call after any case study CRUD operation
 */
export function invalidateCaseStudyCache(): void {
  cachedCaseStudies = null;
  cacheTimestamp = 0;
}

// Helper functions for case study caching and industry normalization

import type { CaseStudy, Industry } from './types';
import { INDUSTRIES } from './types';
import { getCachedData, setCacheData } from './cache';
import { getAllCaseStudies } from './crud';

// Re-export for convenience
export { invalidateCaseStudyCache } from './cache';

/**
 * Get case studies with caching (5-minute TTL)
 * Exported for use by other modules (e.g., workflow)
 */
export async function getCachedCaseStudies(): Promise<CaseStudy[]> {
  const { data, isValid } = getCachedData();
  if (isValid && data) {
    return data;
  }

  const caseStudies = await getAllCaseStudies();
  setCacheData(caseStudies);
  return caseStudies;
}

/**
 * Normalize industry string to valid Industry type
 */
export function normalizeIndustry(industry: string): Industry | null {
  const normalized = industry.trim();

  // Direct match
  if (INDUSTRIES.includes(normalized as Industry)) {
    return normalized as Industry;
  }

  // Case-insensitive match
  const lowerIndustry = normalized.toLowerCase();
  for (const validIndustry of INDUSTRIES) {
    if (validIndustry.toLowerCase() === lowerIndustry) {
      return validIndustry;
    }
  }

  // Partial/fuzzy matching for common variations
  const mappings: Record<string, Industry> = {
    'artificial intelligence': 'AI',
    'machine learning': 'AI',
    'ml': 'AI',
    'saas': 'Software',
    'tech': 'Software',
    'technology': 'Software',
    'ecommerce': 'Retail',
    'e-commerce': 'Retail',
    'fintech': 'Finance & Insurance',
    'finance': 'Finance & Insurance',
    'insurance': 'Finance & Insurance',
    'banking': 'Finance & Insurance',
    'health': 'Healthcare',
    'medical': 'Healthcare',
    'entertainment': 'Media',
    'publishing': 'Media',
    'energy': 'Energy & Utilities',
    'utilities': 'Energy & Utilities',
    'consulting': 'Business Services',
    'services': 'Business Services',
  };

  for (const [key, value] of Object.entries(mappings)) {
    if (lowerIndustry.includes(key)) {
      return value;
    }
  }

  return null;
}

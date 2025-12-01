// Helper functions to match case studies to leads

import { type CaseStudy, type Industry } from './case-studies';
import { getAllCaseStudies } from './firebase-case-studies';

/**
 * Module-level cache for case studies
 */
let cachedCaseStudies: CaseStudy[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get case studies with caching (5-minute TTL)
 * Exported for use by other modules (e.g., workflow)
 */
export async function getCachedCaseStudies(): Promise<CaseStudy[]> {
  const now = Date.now();
  if (cachedCaseStudies && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedCaseStudies;
  }

  cachedCaseStudies = await getAllCaseStudies();
  cacheTimestamp = now;
  return cachedCaseStudies;
}

/**
 * Invalidate cache - call after any case study CRUD operation
 */
export function invalidateCaseStudyCache(): void {
  cachedCaseStudies = null;
  cacheTimestamp = 0;
}

/**
 * Search case studies by keywords in description (operates on provided list)
 */
function searchCaseStudiesInList(caseStudies: CaseStudy[], query: string): CaseStudy[] {
  const searchTerm = query.toLowerCase();
  return caseStudies.filter(cs =>
    cs.featuredText.toLowerCase().includes(searchTerm) ||
    cs.company.toLowerCase().includes(searchTerm) ||
    cs.products.some(p => p.toLowerCase().includes(searchTerm))
  );
}

/**
 * Get case studies by industry (operates on provided list)
 */
function getCaseStudiesByIndustryInList(caseStudies: CaseStudy[], industry: Industry): CaseStudy[] {
  return caseStudies.filter(cs => cs.industry === industry);
}

/**
 * Industry detection keywords
 */
const INDUSTRY_KEYWORDS: Record<Industry, string[]> = {
  'AI': ['ai', 'artificial intelligence', 'machine learning', 'ml', 'llm', 'gpt', 'neural'],
  'Software': ['saas', 'software', 'platform', 'app', 'application', 'developer', 'api'],
  'Retail': ['ecommerce', 'e-commerce', 'retail', 'store', 'shop', 'commerce', 'marketplace'],
  'Healthcare': ['health', 'medical', 'patient', 'clinical', 'hospital', 'pharma'],
  'Finance & Insurance': ['fintech', 'finance', 'banking', 'insurance', 'payment', 'trading'],
  'Media': ['media', 'streaming', 'content', 'publishing', 'news', 'entertainment'],
  'Business Services': ['consulting', 'service', 'agency', 'b2b'],
  'Energy & Utilities': ['energy', 'utilities', 'power', 'electric'],
};

/**
 * Use case detection keywords
 */
const USE_CASE_KEYWORDS: Record<string, string[]> = {
  'performance': ['fast', 'slow', 'performance', 'speed', 'latency', 'load time'],
  'deployment': ['deploy', 'deployment', 'ci/cd', 'pipeline', 'build', 'release'],
  'scale': ['scale', 'traffic', 'growth', 'users', 'concurrent'],
  'developer-experience': ['dx', 'developer experience', 'workflow', 'productivity'],
  'ecommerce': ['black friday', 'sales', 'conversion', 'checkout', 'cart'],
};

/**
 * Detect industry from lead data
 */
export function detectIndustry(company: string, message: string): Industry | null {
  const text = `${company} ${message}`.toLowerCase();

  // Score each industry based on keyword matches
  const scores: Record<Industry, number> = {} as Record<Industry, number>;

  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    scores[industry as Industry] = keywords.filter(keyword =>
      text.includes(keyword)
    ).length;
  }

  // Find industry with highest score
  const entries = Object.entries(scores) as [Industry, number][];
  entries.sort((a, b) => b[1] - a[1]);

  // Return industry if we found at least one keyword match
  return entries[0][1] > 0 ? entries[0][0] : null;
}

/**
 * Detect use cases from lead message
 */
export function detectUseCases(message: string): string[] {
  const text = message.toLowerCase();
  const matches: string[] = [];

  for (const [useCase, keywords] of Object.entries(USE_CASE_KEYWORDS)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      matches.push(useCase);
    }
  }

  return matches;
}

/**
 * Case study with matching metadata
 */
export interface CaseStudyMatch {
  caseStudy: CaseStudy;
  matchReason: string;
  score: number;
}

/**
 * Find relevant case studies for a lead (async - uses Firestore)
 * Uses multiple strategies to find the best matches
 */
export async function findRelevantCaseStudies(
  lead: { company: string; message: string },
  maxResults: number = 3
): Promise<CaseStudy[]> {
  const matches = await findRelevantCaseStudiesWithReason(lead, maxResults);
  return matches.map(m => m.caseStudy);
}

/**
 * Find relevant case studies with matching reasons (for debugging)
 * Now async - fetches from Firestore with caching
 */
export async function findRelevantCaseStudiesWithReason(
  lead: { company: string; message: string },
  maxResults: number = 3
): Promise<CaseStudyMatch[]> {
  const allCaseStudies = await getCachedCaseStudies();
  const detectedIndustry = detectIndustry(lead.company, lead.message);
  const useCases = detectUseCases(lead.message);

  const relevantStudies = new Map<string, { study: CaseStudy; score: number; reasons: string[] }>();

  // Strategy 1: Match by industry (highest priority)
  if (detectedIndustry) {
    const industryMatches = getCaseStudiesByIndustryInList(allCaseStudies, detectedIndustry);
    industryMatches.forEach(study => {
      relevantStudies.set(study.id, {
        study,
        score: 10,
        reasons: [`Industry match: ${detectedIndustry}`]
      });
    });
  }

  // Strategy 2: Search by use case keywords
  useCases.forEach(useCase => {
    const matches = searchCaseStudiesInList(allCaseStudies, useCase);
    matches.forEach(study => {
      const existing = relevantStudies.get(study.id);
      if (existing) {
        existing.score += 5; // Boost score if already matched
        existing.reasons.push(`Use case: ${useCase}`);
      } else {
        relevantStudies.set(study.id, {
          study,
          score: 5,
          reasons: [`Use case: ${useCase}`]
        });
      }
    });
  });

  // Strategy 3: Keyword search in message
  const messageWords = lead.message
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 4); // Only words longer than 4 chars

  messageWords.forEach(word => {
    const matches = searchCaseStudiesInList(allCaseStudies, word);
    matches.forEach(study => {
      const existing = relevantStudies.get(study.id);
      if (existing) {
        existing.score += 1;
        if (!existing.reasons.some(r => r.startsWith('Keywords:'))) {
          existing.reasons.push(`Keywords: ${word}`);
        }
      } else {
        relevantStudies.set(study.id, {
          study,
          score: 1,
          reasons: [`Keywords: ${word}`]
        });
      }
    });
  });

  // Strategy 4: If no matches found, return some popular case studies from Firestore
  if (relevantStudies.size === 0) {
    const fallbackIds = ['notion', 'leonardo-ai', 'helly-hansen'];
    fallbackIds.forEach(id => {
      const study = allCaseStudies.find(cs => cs.id === id);
      if (study) {
        relevantStudies.set(study.id, {
          study,
          score: 0,
          reasons: ['Fallback: Popular case study']
        });
      }
    });
  }

  // Sort by score and return top N
  const sorted = Array.from(relevantStudies.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return sorted.map(item => ({
    caseStudy: item.study,
    matchReason: item.reasons.join(' • '),
    score: item.score
  }));
}

/**
 * Valid industries for matching
 */
const VALID_INDUSTRIES: Industry[] = [
  'AI',
  'Software',
  'Retail',
  'Healthcare',
  'Finance & Insurance',
  'Media',
  'Business Services',
  'Energy & Utilities',
];

/**
 * Normalize industry string to valid Industry type
 */
function normalizeIndustry(industry: string): Industry | null {
  const normalized = industry.trim();

  // Direct match
  if (VALID_INDUSTRIES.includes(normalized as Industry)) {
    return normalized as Industry;
  }

  // Case-insensitive match
  const lowerIndustry = normalized.toLowerCase();
  for (const validIndustry of VALID_INDUSTRIES) {
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

/**
 * Find case studies matching by problem/use case fit (NOT industry)
 * Uses use case keywords and message content matching
 */
export async function findCaseStudiesByProblemFit(
  lead: { company: string; message: string },
  maxResults: number = 2
): Promise<CaseStudyMatch[]> {
  const allCaseStudies = await getCachedCaseStudies();
  const useCases = detectUseCases(lead.message);
  const relevantStudies = new Map<string, { study: CaseStudy; score: number; reasons: string[] }>();

  // Strategy 1: Match by use case keywords
  useCases.forEach(useCase => {
    const matches = searchCaseStudiesInList(allCaseStudies, useCase);
    matches.forEach(study => {
      const existing = relevantStudies.get(study.id);
      if (existing) {
        existing.score += 5;
        existing.reasons.push(`Use case: ${useCase}`);
      } else {
        relevantStudies.set(study.id, {
          study,
          score: 5,
          reasons: [`Use case: ${useCase}`]
        });
      }
    });
  });

  // Strategy 2: Keyword search in message
  const messageWords = lead.message
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 4);

  messageWords.forEach(word => {
    const matches = searchCaseStudiesInList(allCaseStudies, word);
    matches.forEach(study => {
      const existing = relevantStudies.get(study.id);
      if (existing) {
        existing.score += 1;
        if (!existing.reasons.some(r => r.startsWith('Keywords:'))) {
          existing.reasons.push(`Keywords: ${word}`);
        }
      } else {
        relevantStudies.set(study.id, {
          study,
          score: 1,
          reasons: [`Keywords: ${word}`]
        });
      }
    });
  });

  // Sort by score and return top N
  const sorted = Array.from(relevantStudies.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return sorted.map(item => ({
    caseStudy: item.study,
    matchReason: item.reasons.join(' • '),
    score: item.score
  }));
}

/**
 * Find case studies matching by industry fit only
 * Uses the agent-discovered industry (passed as parameter)
 */
export async function findCaseStudiesByIndustryFit(
  industry: string | undefined,
  maxResults: number = 2
): Promise<CaseStudyMatch[]> {
  if (!industry) {
    return [];
  }

  const normalizedIndustry = normalizeIndustry(industry);
  if (!normalizedIndustry) {
    return [];
  }

  const allCaseStudies = await getCachedCaseStudies();
  const industryMatches = allCaseStudies.filter(cs => cs.industry === normalizedIndustry);

  return industryMatches.slice(0, maxResults).map(study => ({
    caseStudy: study,
    matchReason: `Industry: ${normalizedIndustry}`,
    score: 10
  }));
}

/**
 * Get a summary of detected context for debugging (async)
 */
export async function getMatchingContext(lead: { company: string; message: string }) {
  return {
    detectedIndustry: detectIndustry(lead.company, lead.message),
    detectedUseCases: detectUseCases(lead.message),
    relevantCaseStudies: await findRelevantCaseStudies(lead),
  };
}

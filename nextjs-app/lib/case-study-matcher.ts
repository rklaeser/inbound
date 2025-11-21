// Helper functions to match case studies to leads

import {
  CASE_STUDIES,
  getCaseStudiesByIndustry,
  searchCaseStudies,
  type CaseStudy,
  type Industry,
} from './case-studies';

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
  const scores: Record<Industry, number> = {} as any;

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
 * Find relevant case studies for a lead
 * Uses multiple strategies to find the best matches
 */
export function findRelevantCaseStudies(
  lead: { company: string; message: string },
  maxResults: number = 3
): CaseStudy[] {
  const matches = findRelevantCaseStudiesWithReason(lead, maxResults);
  return matches.map(m => m.caseStudy);
}

/**
 * Find relevant case studies with matching reasons (for debugging)
 */
export function findRelevantCaseStudiesWithReason(
  lead: { company: string; message: string },
  maxResults: number = 3
): CaseStudyMatch[] {
  const detectedIndustry = detectIndustry(lead.company, lead.message);
  const useCases = detectUseCases(lead.message);

  const relevantStudies = new Map<string, { study: CaseStudy; score: number; reasons: string[] }>();

  // Strategy 1: Match by industry (highest priority)
  if (detectedIndustry) {
    const industryMatches = getCaseStudiesByIndustry(detectedIndustry);
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
    const matches = searchCaseStudies(useCase);
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
    const matches = searchCaseStudies(word);
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

  // Strategy 4: If no matches found, return some popular case studies
  if (relevantStudies.size === 0) {
    // Return diverse case studies (one from each major industry)
    const fallbackIds = ['notion', 'leonardo-ai', 'helly-hansen'];
    fallbackIds.forEach(id => {
      const study = CASE_STUDIES.find(cs => cs.id === id);
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
 * Get a summary of detected context for debugging
 */
export function getMatchingContext(lead: { company: string; message: string }) {
  return {
    detectedIndustry: detectIndustry(lead.company, lead.message),
    detectedUseCases: detectUseCases(lead.message),
    relevantCaseStudies: findRelevantCaseStudies(lead),
  };
}

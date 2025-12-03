// Vector-based case study matching using semantic similarity

import type { CaseStudy, Industry } from './types';
import { getAllCaseStudies } from './crud';
import { generateEmbedding, findTopSimilar } from './embedding';

interface CaseStudyWithEmbedding {
  caseStudy: CaseStudy;
  embedding: number[];
}

/**
 * Minimum similarity threshold for showing a case study
 * Below this threshold, we consider the match too weak
 * Cosine similarity ranges from 0 to 1:
 * - 0.8-1.0: Very high similarity
 * - 0.6-0.8: Good similarity
 * - 0.5-0.6: Moderate similarity
 * - 0.4-0.5: Acceptable for short queries vs long documents
 * - Below 0.4: Too weak to show
 */
export const SIMILARITY_THRESHOLD = 0.4;

/**
 * Case study with matching metadata (vector-based)
 */
export interface CaseStudyVectorMatch {
  caseStudy: CaseStudy;
  matchReason: string;
  similarity: number;
}

/**
 * Find relevant case studies using semantic similarity with matching reasons
 *
 * @param lead - Lead information (company and message)
 * @param maxResults - Maximum number of case studies to return (default: 3)
 * @param industry - Optional industry to include in query and filter results
 */
export async function findRelevantCaseStudiesVectorWithReason(
  lead: { company: string; message: string },
  maxResults: number = 3,
  industry?: Industry | null
): Promise<CaseStudyVectorMatch[]> {
  try {
    // Create query text from lead information, including industry if provided
    const queryText = industry
      ? `Company: ${lead.company}. Industry: ${industry}. Inquiry: ${lead.message}`
      : `Company: ${lead.company}. Inquiry: ${lead.message}`;

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(queryText);

    // Fetch all case studies from Firebase (with embeddings)
    const allCaseStudies = await getAllCaseStudies();

    // Filter out case studies without embeddings
    // If industry is provided, optionally filter by industry (or boost industry matches)
    let caseStudiesWithEmbeddings: CaseStudyWithEmbedding[] = allCaseStudies
      .filter((cs: any) => cs.embedding && Array.isArray(cs.embedding))
      .map((cs: any) => ({
        caseStudy: cs,
        embedding: cs.embedding,
      }));

    // If industry is provided, prioritize case studies from that industry
    // (but still include others if they're semantically similar)
    if (industry) {
      // Sort to put industry matches first, but don't filter them out
      caseStudiesWithEmbeddings.sort((a, b) => {
        const aMatches = a.caseStudy.industry === industry ? 1 : 0;
        const bMatches = b.caseStudy.industry === industry ? 1 : 0;
        return bMatches - aMatches;
      });
    }

    if (caseStudiesWithEmbeddings.length === 0) {
      console.warn('[Vector Matcher] No case studies with embeddings found in Firebase');
      return [];
    }

    console.log(`[Vector Matcher] Loaded ${caseStudiesWithEmbeddings.length} case studies with embeddings from Firebase`);

    // Debug: Log embedding dimensions and query text
    console.log(`[Vector Matcher] Query text: "${queryText.substring(0, 100)}..."`);
    console.log(`[Vector Matcher] Query embedding dimension: ${queryEmbedding.length}`);
    console.log(`[Vector Matcher] Query embedding sample: [${queryEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
    console.log(`[Vector Matcher] First case study (${caseStudiesWithEmbeddings[0]?.caseStudy?.company}) embedding sample: [${caseStudiesWithEmbeddings[0]?.embedding?.slice(0, 5).map((v: number) => v.toFixed(4)).join(', ')}...]`);

    // Find most similar case studies
    const results = findTopSimilar(
      queryEmbedding,
      caseStudiesWithEmbeddings.map(cs => ({
        embedding: cs.embedding,
        data: cs.caseStudy,
      })),
      maxResults
    );

    console.log('[Vector Matcher] Top matches:');
    results.forEach((result, idx) => {
      console.log(`  ${idx + 1}. ${result.data.company} (similarity: ${result.similarity.toFixed(3)})`);
    });

    // Filter out results below the similarity threshold
    const filteredResults = results.filter(r => r.similarity >= SIMILARITY_THRESHOLD);

    if (filteredResults.length === 0) {
      console.log(`[Vector Matcher] No matches above threshold ${SIMILARITY_THRESHOLD}. Best match was ${results[0]?.similarity.toFixed(3) || 'N/A'}`);
      return [];
    }

    return filteredResults.map(r => {
      const industryMatch = industry && r.data.industry === industry;
      const matchReason = industryMatch
        ? `Semantic similarity: ${(r.similarity * 100).toFixed(1)}% (Industry: ${industry})`
        : `Semantic similarity: ${(r.similarity * 100).toFixed(1)}%`;

      return {
        caseStudy: r.data,
        matchReason,
        similarity: r.similarity
      };
    });
  } catch (error) {
    console.error('[Vector Matcher] Error finding relevant case studies:', error);

    // Fallback: Try to get any case studies from Firebase
    try {
      const allCaseStudies = await getAllCaseStudies();
      return allCaseStudies.slice(0, maxResults).map(cs => ({
        caseStudy: cs,
        matchReason: 'Fallback: Random selection (vector matching failed)',
        similarity: 0
      }));
    } catch (fallbackError) {
      console.error('[Vector Matcher] Fallback also failed:', fallbackError);
      return [];
    }
  }
}

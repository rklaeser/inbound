import { CaseStudy } from './case-studies';
import { getAllCaseStudies } from './firebase-case-studies';
import { generateEmbedding, findTopSimilar } from './embedding-service';

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
 * - Below 0.5: Too weak to show
 */
export const SIMILARITY_THRESHOLD = 0.5;

/**
 * Case study with matching metadata (vector-based)
 */
export interface CaseStudyVectorMatch {
  caseStudy: CaseStudy;
  matchReason: string;
  similarity: number;
}

/**
 * Find relevant case studies using semantic similarity
 *
 * @param lead - Lead information (company and message)
 * @param maxResults - Maximum number of case studies to return (default: 3)
 * @returns Array of most relevant case studies, ordered by relevance
 */
export async function findRelevantCaseStudiesVector(
  lead: { company: string; message: string },
  maxResults: number = 3
): Promise<CaseStudy[]> {
  const matches = await findRelevantCaseStudiesVectorWithReason(lead, maxResults);
  return matches.map(m => m.caseStudy);
}

/**
 * Find relevant case studies using semantic similarity with matching reasons
 */
export async function findRelevantCaseStudiesVectorWithReason(
  lead: { company: string; message: string },
  maxResults: number = 3
): Promise<CaseStudyVectorMatch[]> {
  try {
    // Create query text from lead information
    const queryText = `Company: ${lead.company}. Inquiry: ${lead.message}`;

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(queryText);

    // Fetch all case studies from Firebase (with embeddings)
    const allCaseStudies = await getAllCaseStudies();

    // Filter out case studies without embeddings
    const caseStudiesWithEmbeddings: CaseStudyWithEmbedding[] = allCaseStudies
      .filter((cs: any) => cs.embedding && Array.isArray(cs.embedding))
      .map((cs: any) => ({
        caseStudy: cs,
        embedding: cs.embedding,
      }));

    if (caseStudiesWithEmbeddings.length === 0) {
      console.warn('[Vector Matcher] No case studies with embeddings found in Firebase');
      return [];
    }

    console.log(`[Vector Matcher] Loaded ${caseStudiesWithEmbeddings.length} case studies with embeddings from Firebase`);

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

    return filteredResults.map(r => ({
      caseStudy: r.data,
      matchReason: `Semantic similarity: ${(r.similarity * 100).toFixed(1)}%`,
      similarity: r.similarity
    }));
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

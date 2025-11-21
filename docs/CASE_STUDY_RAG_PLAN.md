# Case Study RAG Implementation Plan

## Overview
Upgrade from tool-based case study retrieval to RAG (Retrieval-Augmented Generation) using embeddings for semantic search.

## Current Implementation (v1)
- **Approach**: Tool-based retrieval
- **How it works**: AI has access to search tools (by industry, by product) and can call them during email generation
- **Pros**: Simple to implement, AI-driven decisions
- **Cons**: Keyword-based matching only, AI might not use tools optimally, adds latency with tool calls

## Future Implementation (v2) - RAG with Embeddings

### Architecture

```
┌─────────────┐
│  Lead Data  │
│ (message +  │
│  industry)  │
└──────┬──────┘
       │
       ↓
┌─────────────────┐
│ Create Embedding│
│ (OpenAI API)    │
└──────┬──────────┘
       │
       ↓
┌──────────────────┐      ┌─────────────────┐
│ Vector Similarity│─────→│ Top 2-3 Case    │
│ Search           │      │ Studies         │
└──────┬───────────┘      └─────────┬───────┘
       │                            │
       │ (Retrieves from)           │
       ↓                            ↓
┌─────────────────────┐    ┌──────────────────┐
│ Case Study Vector DB│    │ Email Generation │
│ (Pre-embedded)      │    │ Prompt           │
└─────────────────────┘    └──────────────────┘
```

### Implementation Steps

#### 1. Create Embeddings for Case Studies
```typescript
// lib/case-study-embeddings.ts
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { CASE_STUDIES } from './case-studies';

interface CaseStudyWithEmbedding {
  caseStudy: CaseStudy;
  embedding: number[];
}

// Create searchable text from case study
function getCaseStudySearchText(cs: CaseStudy): string {
  return `
    Company: ${cs.company}
    Industry: ${cs.industry}
    Description: ${cs.description}
    Products: ${cs.products.join(', ')}
    ${cs.quote || ''}
  `.trim();
}

// Generate embeddings for all case studies (run once or cache)
export async function generateCaseStudyEmbeddings() {
  const embedded = await Promise.all(
    CASE_STUDIES.map(async (cs) => {
      const text = getCaseStudySearchText(cs);
      const { embedding } = await embed({
        model: openai.embedding('text-embedding-3-small'),
        value: text,
      });
      return { caseStudy: cs, embedding };
    })
  );
  return embedded;
}
```

#### 2. Store Embeddings
**Options:**
- **Simple**: JSON file (for < 100 case studies)
- **Scalable**: Vector database (Pinecone, Supabase pgvector, Vercel Postgres)
- **Hybrid**: Firebase with embedding arrays in documents

**Recommended for this project**: Firebase Firestore
```typescript
// Store in Firestore collection: case_study_embeddings
interface CaseStudyEmbeddingDoc {
  case_study_id: string;
  embedding: number[];
  company: string;
  industry: string;
  products: string[];
  // ... other metadata for filtering
}
```

#### 3. Semantic Search Function
```typescript
// lib/case-study-search.ts

// Cosine similarity function
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

export async function findRelevantCaseStudies(
  leadMessage: string,
  leadIndustry?: string,
  limit: number = 3
): Promise<CaseStudy[]> {
  // 1. Create embedding for the lead's context
  const queryText = `${leadMessage} ${leadIndustry || ''}`;
  const { embedding: queryEmbedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: queryText,
  });

  // 2. Load all case study embeddings (from cache/DB)
  const allEmbeddings = await loadCaseStudyEmbeddings();

  // 3. Calculate similarity scores
  const scored = allEmbeddings.map((item) => ({
    caseStudy: item.caseStudy,
    score: cosineSimilarity(queryEmbedding, item.embedding),
  }));

  // 4. Sort by score and return top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(item => item.caseStudy);
}
```

#### 4. Integration with Email Generation
```typescript
// lib/ai.ts - Updated generateEmail function

export async function generateEmail(
  lead: LeadFormData,
  classification: ClassificationResult
): Promise<EmailGenerationResult> {
  // 1. Find relevant case studies using RAG
  const relevantCaseStudies = await findRelevantCaseStudies(
    lead.message,
    detectIndustry(lead.company, lead.message), // helper to detect industry
    3 // top 3
  );

  // 2. Format case studies for prompt
  const caseStudyContext = relevantCaseStudies
    .map(cs => `
      - ${cs.company} (${cs.industry}): ${cs.description}
        ${cs.metrics ? 'Results: ' + cs.metrics.map(m => m.value + ' ' + m.description).join(', ') : ''}
        Link: ${cs.url}
    `)
    .join('\n');

  // 3. Include in prompt
  const { object } = await generateObject({
    model: openai("gpt-4o"),
    schema: emailSchema,
    prompt: `${EMAIL_GENERATION_PROMPT}

Lead Information:
Name: ${lead.name}
Company: ${lead.company}
Message: ${lead.message}

Relevant Customer Success Stories (use if relevant):
${caseStudyContext}

IMPORTANT: Only reference these case studies if truly relevant to the lead's needs. Include the URL if you mention a case study.

Generate an appropriate email response.`,
  });

  return object;
}
```

### Benefits of RAG Approach

1. **Semantic Understanding**: Matches based on meaning, not just keywords
   - "We need faster deployments" → Finds Notion case study (15min deploys)
   - "AI-powered platform" → Finds Leonardo.AI case study

2. **Scalability**: Can handle 100+ case studies without prompt bloat
   - Only top 3 most relevant are included
   - Keeps token usage predictable

3. **No Hallucination**: AI only references real case studies provided in context
   - All URLs are real
   - All metrics are accurate
   - All companies are actual Vercel customers

4. **Context-Aware**: Automatically adapts to lead's needs
   - Healthcare lead → Gets PAIGE case study
   - E-commerce lead → Gets Helly Hansen / reMarkable
   - AI company → Gets Leonardo.AI

### Cost Estimation

**Embeddings Cost** (OpenAI text-embedding-3-small):
- $0.00002 per 1K tokens
- ~200 tokens per case study
- 100 case studies = 20K tokens = $0.0004 (one-time)
- Per query: ~50 tokens = $0.000001

**Very cheap!** Less than $0.001 per email generation.

### Migration Path

1. ✅ **Phase 1 (Current)**: Tool-based retrieval
2. **Phase 2**: Generate and store embeddings for existing case studies
3. **Phase 3**: Implement semantic search function
4. **Phase 4**: Replace tool-based calls with RAG retrieval
5. **Phase 5**: A/B test email quality (tool vs RAG)

### When to Migrate

Consider migrating when:
- You have 20+ case studies (RAG becomes more valuable)
- Tool-based retrieval isn't finding the right matches
- You want to reduce latency (no tool calling round-trips)
- You want better semantic matching

---

## Additional Enhancements (Future)

### Hybrid Search
Combine vector similarity with filters:
```typescript
findRelevantCaseStudies(
  message: string,
  filters?: {
    industries?: Industry[];
    products?: VercelProduct[];
    hasMetrics?: boolean;
  }
)
```

### Caching
- Cache embeddings in Redis/Firebase
- Pre-compute embeddings on case study updates
- Cache query embeddings for common inquiries

### Analytics
Track which case studies are most referenced:
- Most relevant by industry
- Highest conversion when included
- A/B test with/without case studies

### Dynamic Updates
- Webhook to re-embed when case studies update
- Admin UI to add new case studies
- Automatic embedding generation on insert

# Case Studies Integration - Usage Guide

## Overview

The case studies system automatically enriches AI-generated emails with relevant, real customer success stories from Vercel. This prevents hallucination by only referencing actual case studies with verified metrics and URLs.

## How It Works

### 1. Data Structure

All case studies are stored in `lib/case-studies.ts` with the following structure:

```typescript
{
  id: 'notion',
  company: 'Notion',
  industry: 'Software',
  description: 'What once took an hour to deploy a hotfix now takes just 15 minutes...',
  metrics: [
    { value: '15 minutes', description: 'Deploy time (from 1 hour)' },
    { value: 'Seconds', description: 'Rollback time' }
  ],
  products: ['Next.js', 'Preview Deployments'],
  url: 'https://vercel.com/customers/notion'
}
```

### 2. Automatic Matching

When a lead is submitted, the system:

1. **Detects Industry** - Uses keyword matching to identify the lead's industry
2. **Detects Use Cases** - Identifies specific needs (performance, deployment, scaling, etc.)
3. **Scores & Ranks** - Assigns relevance scores to each case study
4. **Returns Top 3** - Provides the most relevant case studies to the AI

### 3. Email Generation

The AI receives:
- Lead information (name, company, message)
- Classification data (quality, confidence, reasoning)
- **Top 3 relevant case studies** with strict guidelines:
  - Only use if truly relevant
  - Must include URLs when mentioned
  - Cannot modify metrics
  - Treat as factual references

## Current Case Studies

We currently have 7 real Vercel customer case studies:

| Company | Industry | Key Metrics | Products |
|---------|----------|-------------|----------|
| Notion | Software | 15min deploys (from 1hr) | Next.js, Preview Deployments |
| PAIGE | Healthcare | 22% revenue ↑, 76% conversion ↑ | Next.js, Edge Functions |
| Leonardo.AI | AI | 80% build time reduction | Next.js, Vercel AI SDK |
| Sonos | Retail | Faster time to market | Next.js, Edge Functions |
| Stripe | Finance | 19 days to viral campaign | Next.js, ISR |
| Helly Hansen | Retail | 80% Black Friday growth | Next.js, Image Optimization |
| reMarkable | Retail | 87% build time decrease | Next.js, ISR |

## Adding New Case Studies

To add a new case study:

1. **Open `lib/case-studies.ts`**
2. **Add to the `CASE_STUDIES` array**:

```typescript
{
  id: 'company-slug',
  company: 'Company Name',
  industry: 'Software', // Must match Industry type
  description: 'One-sentence description of their success',
  metrics: [
    { value: '50%', description: 'What improved' }
  ],
  products: ['Next.js'], // Must match VercelProduct type
  url: 'https://vercel.com/customers/company-slug',
  quote: 'Optional customer quote', // Optional
  quotedPerson: { // Optional
    name: 'Person Name',
    title: 'Their Title'
  }
}
```

3. **Verify the data**:
   - Ensure all metrics are accurate
   - Verify the URL is correct and accessible
   - Confirm the industry matches one of the allowed types

4. **Build & test**:
```bash
npm run build
```

## Matching Logic

### Industry Detection

The system looks for industry keywords in the lead's company name and message:

- **AI**: ai, artificial intelligence, machine learning, llm, gpt
- **Software**: saas, software, platform, app, developer
- **Retail**: ecommerce, retail, store, shop, marketplace
- **Healthcare**: health, medical, patient, clinical
- **Finance**: fintech, finance, banking, payment
- And more...

### Use Case Detection

Identifies specific needs:
- **Performance**: fast, slow, speed, latency
- **Deployment**: deploy, ci/cd, build, release
- **Scale**: scale, traffic, growth
- **E-commerce**: black friday, sales, conversion

### Scoring System

Case studies receive points for:
- **Industry match**: +10 points
- **Use case match**: +5 points per match
- **Keyword match**: +1 point per keyword

Top 3 scored case studies are included in the email generation.

## Testing the System

### Manual Test

You can test the matching logic directly:

```typescript
import { findRelevantCaseStudies } from '@/lib/case-study-matcher';

const lead = {
  company: 'TechStartup AI',
  message: 'We need faster deployment times for our AI platform'
};

const results = findRelevantCaseStudies(lead, 3);
console.log(results);
// Will likely return: Leonardo.AI, Notion, and others
```

### Debug Matching Context

```typescript
import { getMatchingContext } from '@/lib/case-study-matcher';

const context = getMatchingContext({
  company: 'HealthTech Inc',
  message: 'Looking to improve our patient portal performance'
});

console.log(context);
// {
//   detectedIndustry: 'Healthcare',
//   detectedUseCases: ['performance'],
//   relevantCaseStudies: [PAIGE case study, ...]
// }
```

## Example Email Output

### Input Lead:
```
Company: "AI Startup Inc"
Message: "We're building an AI-powered analytics platform and need
          faster deployments and better developer experience"
```

### System Matches:
1. Leonardo.AI (AI industry + build time improvements)
2. Notion (deployment speed improvements)
3. Sonos (developer experience)

### Generated Email (excerpt):
```
Hi [Name],

Thanks for reaching out about improving your deployment workflow...

We've helped AI companies like Leonardo.AI cut their build times by 80%
(from 10 minutes to just 2 minutes): https://vercel.com/customers/leonardo-ai

I'd be happy to show you how Vercel can help your team ship faster...
```

## Benefits

✅ **No Hallucination** - Only real, verified case studies are referenced
✅ **Always Accurate** - Metrics come directly from official sources
✅ **Context-Aware** - Matches industry and use case automatically
✅ **Credible** - Every case study includes a link to the source
✅ **Scalable** - Easy to add more case studies as they're published

## Future: RAG Implementation

See `CASE_STUDY_RAG_PLAN.md` for the plan to upgrade to semantic search using embeddings. This will provide:
- Better semantic matching (meaning vs keywords)
- Support for 100+ case studies without prompt bloat
- More accurate relevance scoring
- Lower latency (no tool calling)

## Support

Questions about the case study system? Check:
- `lib/case-studies.ts` - Data structure and utilities
- `lib/case-study-matcher.ts` - Matching and retrieval logic
- `lib/ai.ts` - Integration with email generation
- `CASE_STUDY_RAG_PLAN.md` - Future enhancements

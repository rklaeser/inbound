# Product Knowledge Gap in Email Generation

## Problem

When leads ask technical questions, the AI generates generic emails because it lacks product knowledge.

### Example: Caching Question

**Lead message:**
> "I'm having trouble with caching on my site - my pages keep showing stale data after deployments. Is this a limitation of my plan or am I doing something wrong?"

**Current AI response (generic):**
> "Happy to help. I can walk you through how Vercel resolves caching issues."

**Ideal response (with product knowledge):**
> "Stale data after deployments is typically an ISR revalidation configuration issue, not a plan limitation. I can walk you through how to set up on-demand revalidation with cache tags so your pages update immediately after deployments."

### Example: SAML SSO Question

**Lead message:**
> "We need SAML SSO for our team. Is this available on Pro or do we need Enterprise?"

**Ideal response:**
> "SAML SSO is an Enterprise feature - I can walk you through our Enterprise security capabilities and set up a trial for your team."

---

## Solution

Give the research agent access to Vercel documentation search via Exa (with `includeDomains: ['vercel.com']`). The research report includes product context that email generation uses.

### How It Works
1. Research agent has `searchVercelDocs` tool available
2. When lead asks technical questions, agent searches Vercel docs
3. Research report includes **Product Context** section with findings
4. Email generation uses research report (no changes needed)
5. SDR reviews final email and can correct any inaccuracies

---

## Implementation

### Research Agent (`workflow-services.ts`)

Added `searchVercelDocs` tool:
```typescript
const searchVercelDocs = tool({
  description: 'Search Vercel documentation for product features, pricing, plans, and technical details.',
  inputSchema: z.object({
    query: z.string().describe('What to search for in Vercel docs'),
  }),
  execute: async ({ query }) => {
    const exa = new Exa(process.env.EXA_API_KEY);
    const result = await exa.searchAndContents(query, {
      numResults: 3,
      includeDomains: ['vercel.com'],
      summary: true,
    });
    // Returns formatted results with sources
  }
});
```

Updated system prompt to include:
- Tool listed in "Available tools"
- Research strategy step: "If the lead's message asks technical questions about Vercel features, pricing, or capabilities, use searchVercelDocs"
- Report format includes optional **Product Context** section

---

## Status

- [x] Add `searchVercelDocs` tool to research agent
- [x] Update research agent system prompt
- [ ] Test with technical question leads

# Eval System for Lead Submit Path

## Scope

Two evaluations:
1. **Classification** - LLM-as-judge: is the classification correct for this lead?
2. **High-quality email** - LLM-as-judge: is the generated email good? (only for `high-quality` leads)

## Action vs Evaluation Prompts

| Aspect | Action Prompt | Evaluation Prompt |
|--------|---------------|-------------------|
| **Purpose** | Produce output | Judge quality of output |
| **Sees** | Input only | Input + Output + Context |
| **Optimizes for** | Speed, consistency | Accuracy, catching errors |
| **Question** | "What should this be?" | "Is this actually correct?" |

**Key principle:** Eval prompts encode *human judgment criteria*, not rule-following.
- Bad: "Did the AI follow the classification criteria?"
- Good: "Would a human SDR agree? Is there real revenue potential here?"

## Architecture

```
nextjs-app/
├── lib/
│   └── types.ts                   # Add eval_results to Lead, eval prompts to Configuration
├── app/
│   ├── dashboard/
│   │   ├── settings/page.tsx      # Add eval prompt textareas
│   │   └── leads/[id]/page.tsx    # Add Eval Results section below Timeline
│   └── api/
│       └── leads/[id]/
│           └── evaluate/route.ts  # New endpoint to run evals
├── lib/
│   ├── settings-defaults.ts       # Default eval prompts
│   └── eval-service.ts            # Evaluation logic
└── scripts/
    └── run-batch-eval.ts          # Batch eval for golden dataset
```

## Implementation

### 1. Data Model Changes

#### `lib/types.ts` - Add to Configuration interface

```typescript
prompts: {
  classification: string;           // Existing action prompt
  classificationEval: string;       // NEW: Evaluation prompt
  emailHighQuality: string;         // Existing action prompt
  emailHighQualityEval: string;     // NEW: Evaluation prompt
};
```

#### `lib/types.ts` - Add to Lead interface

```typescript
eval_results?: {
  classification?: {
    score: number;              // 1-5
    pass: boolean;
    reasoning: string;
    evaluated_at: Date;
    model: string;              // e.g., "gpt-4o"
  };
  email?: {
    scores: {
      personalization: number;  // 1-5
      tone: number;
      relevance: number;
      cta: number;
    };
    overall: number;
    pass: boolean;
    summary: string;
    evaluated_at: Date;
    model: string;
  };
};
```

### 2. Default Eval Prompts

#### `lib/settings-defaults.ts`

```typescript
classificationEval: `You are evaluating whether a lead classification is correct.

You will see: the lead's form submission AND the AI's classification.

Score 1-5:
1: Clearly wrong classification
2: Questionable, likely wrong
3: Defensible but not ideal
4: Good classification
5: Exactly right

Consider:
- Would an experienced SDR agree with this classification?
- Does this lead have real revenue potential (high-quality) or not?
- Is the reasoning sound?

Respond in JSON:
{
  "score": N,
  "pass": true/false,
  "reasoning": "Why this score"
}

Pass threshold: score >= 4`,

emailHighQualityEval: `You are evaluating a sales email for a high-quality inbound lead.

Score each dimension 1-5:

**Personalization** (1-5)
1: Generic template, no specific references
5: References specific pain points from lead's message

**Tone** (1-5)
1: Too pushy or robotic
5: Warm, consultative, human

**Relevance** (1-5)
1: Irrelevant features/case studies
5: Directly addresses stated needs

**Call-to-Action** (1-5)
1: No clear next step or too aggressive
5: Natural, contextually appropriate

Respond in JSON:
{
  "personalization": { "score": N, "note": "..." },
  "tone": { "score": N, "note": "..." },
  "relevance": { "score": N, "note": "..." },
  "cta": { "score": N, "note": "..." },
  "overall": N,
  "pass": true/false,
  "summary": "One sentence"
}

Pass threshold: overall >= 3`
```

### 3. Settings UI Updates

#### `app/dashboard/settings/page.tsx`

**Classification Section** (after existing Classification Prompt ~line 370):
```tsx
{/* Evaluation Prompt */}
<div className="space-y-2">
  <label className="text-sm font-medium">Evaluation Prompt</label>
  <p className="text-xs text-muted-foreground">
    Used by a separate model to judge classification quality
  </p>
  <textarea
    value={config.prompts.classificationEval}
    onChange={(e) => handlePromptChange('classificationEval', e.target.value)}
    className="w-full h-48 ..."
  />
</div>
```

**Emails > High Quality Section** (after existing Body Prompt ~line 420):
```tsx
{/* Evaluation Prompt */}
<div className="space-y-2">
  <label className="text-sm font-medium">Evaluation Prompt</label>
  <p className="text-xs text-muted-foreground">
    Used by a separate model to judge email quality
  </p>
  <textarea
    value={config.prompts.emailHighQualityEval}
    onChange={(e) => handlePromptChange('emailHighQualityEval', e.target.value)}
    className="w-full h-48 ..."
  />
</div>
```

### 4. Lead Detail Page - Eval Results Section

#### `app/dashboard/leads/[id]/page.tsx`

Add below Timeline section (~after line 1000):

```tsx
{/* Eval Results */}
{lead.eval_results && (
  <Section title="Eval Results" id="eval-results">
    <div className="space-y-4">
      {/* Classification Eval */}
      {lead.eval_results.classification && (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Classification</span>
            <Badge variant={lead.eval_results.classification.pass ? "success" : "destructive"}>
              {lead.eval_results.classification.pass ? "Pass" : "Fail"}
              ({lead.eval_results.classification.score}/5)
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {lead.eval_results.classification.reasoning}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Model: {lead.eval_results.classification.model}
          </p>
        </div>
      )}

      {/* Email Eval (high-quality only) */}
      {lead.eval_results.email && (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Email Quality</span>
            <Badge variant={lead.eval_results.email.pass ? "success" : "destructive"}>
              {lead.eval_results.email.pass ? "Pass" : "Fail"}
              ({lead.eval_results.email.overall}/5)
            </Badge>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-2">
            <ScoreChip label="Personal" score={lead.eval_results.email.scores.personalization} />
            <ScoreChip label="Tone" score={lead.eval_results.email.scores.tone} />
            <ScoreChip label="Relevance" score={lead.eval_results.email.scores.relevance} />
            <ScoreChip label="CTA" score={lead.eval_results.email.scores.cta} />
          </div>
          <p className="text-sm text-muted-foreground">
            {lead.eval_results.email.summary}
          </p>
        </div>
      )}

      {/* Run Eval Button (if no results yet) */}
      {!lead.eval_results.classification && (
        <Button onClick={runEvaluation} disabled={evaluating}>
          {evaluating ? "Evaluating..." : "Run Evaluation"}
        </Button>
      )}
    </div>
  </Section>
)}
```

### 5. Eval Service

#### `lib/eval-service.ts`

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { getConfiguration } from './configuration-helpers';
import type { Lead } from './types';

const EVAL_MODEL = 'gpt-4o'; // Different from action model

export async function evaluateClassification(lead: Lead) {
  const config = await getConfiguration();

  const { text } = await generateText({
    model: openai(EVAL_MODEL),
    system: config.prompts.classificationEval,
    prompt: `
Lead Form Submission:
- Name: ${lead.form_data.name}
- Email: ${lead.form_data.email}
- Company: ${lead.form_data.company || 'Not provided'}
- Message: ${lead.form_data.message}

AI Classification: ${lead.bot_research?.classification}
AI Confidence: ${lead.bot_research?.confidence}
AI Reasoning: ${lead.bot_research?.reasoning}
`,
  });

  const result = JSON.parse(text);
  return {
    score: result.score,
    pass: result.pass,
    reasoning: result.reasoning,
    evaluated_at: new Date(),
    model: EVAL_MODEL,
  };
}

export async function evaluateEmail(lead: Lead) {
  // Only for high-quality leads
  if (lead.bot_research?.classification !== 'high-quality') {
    return null;
  }

  const config = await getConfiguration();

  const { text } = await generateText({
    model: openai(EVAL_MODEL),
    system: config.prompts.emailHighQualityEval,
    prompt: `
Lead's original message:
${lead.form_data.message}

Company: ${lead.form_data.company || 'Not provided'}

Generated email:
${lead.bot_text?.body || 'NO EMAIL GENERATED'}
`,
  });

  const result = JSON.parse(text);
  return {
    scores: {
      personalization: result.personalization.score,
      tone: result.tone.score,
      relevance: result.relevance.score,
      cta: result.cta.score,
    },
    overall: result.overall,
    pass: result.pass,
    summary: result.summary,
    evaluated_at: new Date(),
    model: EVAL_MODEL,
  };
}

export async function evaluateLead(lead: Lead) {
  const [classification, email] = await Promise.all([
    evaluateClassification(lead),
    evaluateEmail(lead),
  ]);

  return {
    classification,
    ...(email && { email }),
  };
}
```

### 6. API Endpoint

#### `app/api/leads/[id]/evaluate/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/db';
import { evaluateLead } from '@/lib/eval-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Get lead
  const leadDoc = await adminDb.collection('leads').doc(id).get();
  if (!leadDoc.exists) {
    return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
  }

  const lead = { id: leadDoc.id, ...leadDoc.data() };

  // Run evaluation
  const eval_results = await evaluateLead(lead);

  // Store results
  await adminDb.collection('leads').doc(id).update({ eval_results });

  return NextResponse.json({ success: true, eval_results });
}
```

### 7. Batch Eval Script (Optional)

#### `scripts/run-batch-eval.ts`

```typescript
import 'dotenv/config';

const API_URL = process.env.EVAL_API_URL || 'http://localhost:3000';

async function runBatchEval() {
  // Fetch recent leads
  const response = await fetch(`${API_URL}/api/leads?limit=50`);
  const { leads } = await response.json();

  console.log(`Evaluating ${leads.length} leads...\n`);

  for (const lead of leads) {
    if (lead.eval_results) {
      console.log(`${lead.id}: Already evaluated, skipping`);
      continue;
    }

    console.log(`${lead.id}: Evaluating...`);
    const evalResponse = await fetch(`${API_URL}/api/leads/${lead.id}/evaluate`, {
      method: 'POST',
    });
    const result = await evalResponse.json();

    const classPass = result.eval_results.classification?.pass ? '✓' : '✗';
    const emailPass = result.eval_results.email?.pass ? '✓' : '✗';

    console.log(`  Classification: ${classPass} (${result.eval_results.classification?.score}/5)`);
    if (result.eval_results.email) {
      console.log(`  Email: ${emailPass} (${result.eval_results.email.overall}/5)`);
    }
  }
}

runBatchEval().catch(console.error);
```

### 8. Package.json Scripts

```json
{
  "scripts": {
    "eval:batch": "npx tsx scripts/run-batch-eval.ts"
  }
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `lib/types.ts` | Add `eval_results` to Lead, add eval prompts to Configuration |
| `lib/settings-defaults.ts` | Add default eval prompts |
| `app/dashboard/settings/page.tsx` | Add eval prompt textareas in Classification and Emails sections |
| `app/dashboard/leads/[id]/page.tsx` | Add Eval Results section below Timeline |

## Files to Create

| File | Purpose |
|------|---------|
| `lib/eval-service.ts` | Core evaluation logic with LLM-as-judge |
| `app/api/leads/[id]/evaluate/route.ts` | API endpoint to trigger eval |
| `scripts/run-batch-eval.ts` | Optional: batch evaluate multiple leads |

## Implementation Order

1. Copy this plan to `docs/evaluation-system.md` for team review
2. Data model changes (`lib/types.ts`, `lib/settings-defaults.ts`)
3. Eval service (`lib/eval-service.ts`)
4. API endpoint (`app/api/leads/[id]/evaluate/route.ts`)
5. Settings UI updates
6. Lead detail page UI
7. (Optional) Batch eval script

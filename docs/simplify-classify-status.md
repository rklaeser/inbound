# Simplify Classify Status

## Problem

Currently, leads with low AI confidence go to `classify` status, requiring humans to choose a classification before reviewing. This is confusing because:

1. The Research Report already shows the AI's classification (e.g., "Low Quality, 43% confidence")
2. The UI displays classification buttons as if no classification exists
3. Humans review everything before sending anyway, so they can reclassify during review

**Note**: This is distinct from the rollout gate. When `useAIClassification = false` (during rollout), leads should still go to `classify` so humans classify independently for A/B comparison. This proposal only eliminates the low-confidence → `classify` path.

## Current Flow

```
Lead submitted
    ↓
AI classifies (e.g., low-quality @ 43% confidence)
    ↓
Check: useAIClassification? (based on rollout.percentage)
    ↓
┌─────────────────────────────────────────────────────┐
│ useAIClassification = false (rollout at 0%)         │
│ → status: 'classify'                                │
│ → AI classification stored but NOT applied          │
│ → Human must choose classification first            │
└─────────────────────────────────────────────────────┘
    OR
┌─────────────────────────────────────────────────────┐
│ useAIClassification = true                          │
│ → Check confidence vs threshold                     │
│   → Low confidence: status 'classify'               │
│   → High confidence: status 'review' or 'done'      │
└─────────────────────────────────────────────────────┘
```

**Result**: With default settings (rollout at 0%), ALL leads go to `classify` regardless of AI confidence.

## Proposed Flow

```
Lead submitted
    ↓
AI classifies
    ↓
Check: useAIClassification? (based on rollout.percentage)
    ↓
┌─────────────────────────────────────────────────────┐
│ useAIClassification = false (rollout gate)          │
│ → status: 'classify'                                │
│ → AI classification stored but NOT applied          │
│ → Human classifies independently (for A/B comparison)│
└─────────────────────────────────────────────────────┘
    OR
┌─────────────────────────────────────────────────────┐
│ useAIClassification = true                          │
│ → AI classification applied (regardless of          │
│   confidence)                                       │
│ → Check: auto-send conditions met?                  │
│   → Yes: status 'done', email sent                  │
│   → No:  status 'review', human reviews email       │
│ → NO LONGER goes to 'classify' for low confidence   │
└─────────────────────────────────────────────────────┘
```

**Result**: When AI classification is used, it's always applied regardless of confidence. Humans can reclassify during review if they disagree. The `classify` status is only used for rollout A/B comparison.

## Status Definitions (Updated)

| Status | Meaning |
|--------|---------|
| `processing` | Workflow running, AI analyzing lead |
| `review` | AI classified, human reviews email and can reclassify |
| `done` | Action taken (email sent or forwarded) |
| `classify` | Rollout A/B comparison: human classifies independently |

## Changes Required

### 1. `nextjs-app/workflows/inbound/steps.ts`

**`stepPersistResults`**: Keep the `useAIClassification` branching, but when `useAIClassification = true`, always apply the classification (no low-confidence → classify path).

```typescript
// BEFORE: useAIClassification=true could still go to 'classify' for low confidence
if (useAIClassification) {
  if (needs_review) {
    // Low confidence → 'classify' status
  } else {
    // High confidence → 'review' or 'done'
  }
} else {
  // Store for comparison only, set status to 'classify'
}

// AFTER: useAIClassification=true always applies classification
if (useAIClassification) {
  // Always apply bot classification, status is 'review' or 'done'
  // (never 'classify' based on confidence)
  const botClassification = {
    author: 'bot',
    classification: result.bot_research.classification,
    timestamp: result.bot_research.timestamp,
    needs_review: result.needs_review,  // Keep for UI display
    applied_threshold: result.applied_threshold,
  };
  // ... apply classification
} else {
  // Rollout A/B: store for comparison only, status = 'classify'
  // Human must classify independently
}
```

### 2. `nextjs-app/workflows/inbound/steps.ts`

**`stepDetermineStatus`**: When `useAIClassification = true`, don't use `needs_review` to determine status.

```typescript
// BEFORE: needs_review could affect status even when useAIClassification=true
const needs_review = confidence < threshold;
let status: LeadStatus = 'review';
if (autoSend) {
  status = 'done';
} else if (needs_review) {
  // This path led to 'classify' in some cases
}

// AFTER: When useAIClassification=true, binary decision - auto-send or review
// (needs_review only used for UI display, not status)
let status: LeadStatus = autoSend ? 'done' : 'review';
// needs_review still calculated and stored for UI indicator
```

**Note**: `useAIClassification` is still used and passed through the workflow. We're only changing the behavior when it's `true`.

## UI Implications

### Lead Detail Page (Review Status)

- Shows AI classification as current classification
- Human can reclassify using dropdown if they disagree
- Low confidence indicator can still display (using `needs_review` flag)
- "Suggested" or confidence % can be shown to inform human decision

### Lead List

- Filter by status: `processing`, `classify`, `review`, `done`
- `classify` only appears for rollout A/B leads (when `useAIClassification = false`)

## `needs_review` Field Purpose

Keep the `needs_review` boolean on `ClassificationEntry` for:

1. **UI indicator**: Show warning badge for low-confidence classifications
2. **Analytics**: Track how often humans change low-confidence classifications
3. **Future**: Could re-enable `classify` gate if needed

## Migration

No data migration needed. Existing leads in `classify` status will continue to work—humans can still classify them. New leads will go to:
- `classify` if `useAIClassification = false` (rollout gate)
- `review` or `done` if `useAIClassification = true` (no more low-confidence → classify)

## Rollout Percentage Clarification

`rollout.percentage` still controls whether AI classification is applied:

- **`useAIClassification = false`** (rollout gate): Human classifies independently, AI stored for comparison
- **`useAIClassification = true`**: AI classification applied, human can reclassify during review

The change is: when `useAIClassification = true`, we no longer have a secondary gate based on confidence. Low-confidence classifications are applied just like high-confidence ones—the human can change them during review if they disagree.

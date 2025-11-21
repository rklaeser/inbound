# Lead Status System Refactor - Design Document

**Date:** 2025-01-20
**Status:** Design Complete - Ready for Implementation

---

## Table of Contents
1. [Problem Statement](#problem-statement)
2. [Current System Issues](#current-system-issues)
3. [New Data Model](#new-data-model)
4. [Design Decisions](#design-decisions)
5. [Examples & Flows](#examples--flows)
6. [Migration Strategy](#migration-strategy)
7. [Implementation Plan](#implementation-plan)

---

## Problem Statement

The current system uses a single `status` field that conflates three distinct concepts:
1. **Process state** (processing, review)
2. **Decision maker** (human vs automated)
3. **Final outcome** (sent, dead, forwarded)

This creates confusion and makes it difficult to answer questions like:
- "Show me all leads that required human review"
- "Which leads were auto-processed vs manually handled?"
- "What percentage of duplicates are auto-forwarded vs manually confirmed?"

Additionally, we have redundant UI components showing both classification and action badges, creating visual clutter and mixing concerns.

---

## Current System Issues

### 1. Single `status` Field Conflates Concepts

**Current LeadStatus type:**
```typescript
type LeadStatus =
  | 'processing'      // Process state
  | 'review'          // Process state
  | 'sent'            // Outcome
  | 'dead'            // Outcome
  | 'error'           // Error state
  | 'forwarded'       // Outcome
  | 'pending'         // Legacy
  | 'researching'     // Legacy
  // ... more legacy values
```

**Problems:**
- Can't distinguish between auto-forwarded vs manually forwarded
- `review` status doesn't indicate WHY review is needed
- No way to track autonomy level after lead is closed

### 2. Type System Bug

Workflow returns `'rejected'` status but `LeadStatus` doesn't include it. Should map to `'dead'`.

### 3. UI Redundancy

AllLeads table shows both:
- **Classification badge** - "support", "duplicate", etc.
- **ActionBadge** - "Confirm Support", "Confirm Duplicate", etc.

These are redundant - ActionBadge just adds "Confirm" to the classification name.

### 4. Inconsistent Auto-Actions

Only low-value leads have configurable auto-rejection threshold. Other classifications have hardcoded behavior:
- Duplicates ALWAYS auto-forward (no threshold)
- Support ALWAYS goes to review (no auto-forward option)
- Quality ALWAYS goes to review (no auto-send option)

### 5. Unclear Data Flow

The relationship between classification and status is not documented, making it hard to understand how the system determines actions.

---

## New Data Model

### Three Orthogonal Fields

The new model separates three distinct concerns into separate fields:

```typescript
interface Lead {
  // WHO made the decision (immutable once set)
  autonomy: 'review' | 'auto' | null;

  // WHAT the AI thinks (set by AI classification)
  classification: 'quality' | 'support' | 'duplicate' | 'low-value' | 'dead' | 'uncertain' | null;

  // WHAT happened (terminal state, immutable once set)
  outcome: 'pending' | 'sent' | 'dead' | 'forwarded' | 'error' | null;

  // ... other fields
}
```

### Field Definitions

#### 1. `autonomy` - Decision Maker
**Type:** `'review' | 'auto' | null`

**Meaning:**
- `'review'` - Human decision was/is needed (stays forever even after human acts)
- `'auto'` - System made automatic decision based on confidence thresholds
- `null` - Not yet determined (during processing)

**Immutability:** Set once, never changes. This preserves the record of whether a human was involved.

**Purpose:** Analytics, auditing, understanding automation effectiveness

---

#### 2. `classification` - AI Assessment
**Type:** `'quality' | 'support' | 'duplicate' | 'low-value' | 'dead' | 'uncertain' | null`

**Meaning:**
- `'quality'` - High-value lead, worth personalized outreach
- `'support'` - Existing customer needing support
- `'duplicate'` - Duplicate of existing customer
- `'low-value'` - Not a good fit, likely spam
- `'dead'` - Clearly not a lead (test, competitor, etc.)
- `'uncertain'` - AI is not confident, needs human assessment
- `null` - Not yet classified

**Immutability:** Set by AI once, generally not changed (except by reclassify action)

**Purpose:** Understanding AI performance, driving workflow logic

---

#### 3. `outcome` - Final Result
**Type:** `'pending' | 'sent' | 'dead' | 'forwarded' | 'error' | null`

**Meaning:**
- `null` - Lead is processing (AI workflow running)
- `'pending'` - Awaiting human decision
- `'sent'` - Email sent successfully
- `'dead'` - Lead closed/rejected without sending
- `'forwarded'` - Forwarded to AE or support team
- `'error'` - Workflow failed (terminal state)

**Immutability:** Once set to a non-null, non-pending value, never changes

**Purpose:** Current state, filtering, workflow routing

---

## Design Decisions

### Decision 1: Autonomy Stays Forever
**Question:** When a human acts on a review lead, does autonomy change?

**Decision:** NO - autonomy stays `'review'` forever to preserve the record that a human was involved.

**Rationale:**
- Important for analytics (what % of leads needed human intervention?)
- Auditing (which leads did humans touch?)
- Performance tracking (are we automating more over time?)

---

### Decision 2: Processing is Absence of Outcome
**Question:** Is `processing` a stored value?

**Decision:** NO - `outcome === null` means processing.

**Rationale:**
- Cleaner data model (one less value to manage)
- Processing is a transient state, not a persistent outcome
- Easy to derive: `if (outcome === null) → "Processing"`

---

### Decision 3: Error is Terminal Outcome
**Question:** Is `error` a separate field or an outcome value?

**Decision:** `error` is an outcome value (terminal state).

**Rationale:**
- Errors prevent completion, so they are a type of outcome
- Immutable once set (you don't "recover" from errors, you reclassify)
- Simplifies querying (one field to check for state)

---

### Decision 4: Remove Status Field Entirely
**Question:** Keep `status` for backward compatibility?

**Decision:** NO - clean break, remove `status`, delete existing data.

**Rationale:**
- Clean migration is simpler than maintaining dual systems
- Dataset is small enough to regenerate
- Backward compatibility adds complexity for no benefit

---

### Decision 5: Config-Driven Thresholds for All Classifications
**Question:** Which classifications should have configurable auto-action thresholds?

**Decision:** ALL classifications should have thresholds.

**Configuration:**
```typescript
settings: {
  autoRejectLowValueThreshold: number;      // e.g., 0.90
  autoForwardDuplicateThreshold: number;    // e.g., 0.90
  autoForwardSupportThreshold: number;      // e.g., 0.85
  autoSendQualityThreshold: number;         // e.g., 0.95 (future)
}
```

**Rationale:**
- Flexibility to tune automation per classification
- Consistent pattern across all classification types
- Allows gradual rollout of automation (start conservative, increase over time)

---

### Decision 6: LeadBadge Shows Outcome or Action
**Question:** What should LeadBadge display?

**Decision:** Smart switcher based on outcome:
- **Terminal outcomes** → Show outcome ("Sent", "Dead", "Forwarded")
- **Pending** → Show action derived from classification ("Review", "Confirm Support", etc.)
- **Processing/Error** → Show state ("Processing", "Error")

**Logic:**
```typescript
if (outcome === null) return "Processing";
if (outcome === 'error') return "Error";
if (outcome === 'sent') return "Sent";
if (outcome === 'dead') return "Dead";
if (outcome === 'forwarded') return "Forwarded";
if (outcome === 'pending') {
  if (classification === 'quality') return "Review";
  if (classification === 'support') return "Confirm Support";
  if (classification === 'duplicate') return "Confirm Duplicate";
  if (classification === 'low-value') return "Confirm Dead";
  if (classification === 'uncertain') return "Review";
}
```

**Rationale:**
- User-focused: shows "what should I do?" for pending, "what happened?" for completed
- Removes redundancy with classification badge
- Clear, actionable interface

---

### Decision 7: Remove Classification Column from AllLeads
**Question:** Should AllLeads table show classification badge?

**Decision:** NO - remove classification column, keep only LeadBadge.

**Rationale:**
- LeadBadge already encodes the classification in its logic
- Reduces visual clutter
- More action-oriented (users care about what to do, not AI's reasoning)
- Classification still visible in detail view for transparency

---

### Decision 8: Rename ActionBadge → LeadBadge
**Question:** What should the component be called?

**Decision:** Rename to `LeadBadge`.

**Rationale:**
- "ActionBadge" implies it only shows actions, but it also shows outcomes
- "LeadBadge" is more accurate - it's the primary badge for lead display
- Clearer that it's not just about actions

---

## Examples & Flows

### Example 1: High-Confidence Duplicate (Auto-Forwarded)

**Flow:**
```
1. Lead submitted
   autonomy: null
   classification: null
   outcome: null
   → LeadBadge: "Processing"

2. AI classifies as duplicate with 95% confidence
   Configuration: autoForwardDuplicateThreshold = 0.90
   Decision: 95% >= 90% → auto-forward

3. Workflow completes
   autonomy: 'auto'
   classification: 'duplicate'
   outcome: 'forwarded'
   → LeadBadge: "Forwarded"
```

**Key Points:**
- Never goes to human review
- Autonomy is `'auto'` (system decided)
- Outcome is final and immutable

---

### Example 2: Low-Confidence Duplicate (Manual Review)

**Flow:**
```
1. Lead submitted
   autonomy: null
   classification: null
   outcome: null
   → LeadBadge: "Processing"

2. AI classifies as duplicate with 75% confidence
   Configuration: autoForwardDuplicateThreshold = 0.90
   Decision: 75% < 90% → needs review

3. Workflow completes
   autonomy: 'review'
   classification: 'duplicate'
   outcome: 'pending'
   → LeadBadge: "Confirm Duplicate"

4. Human confirms and forwards
   autonomy: 'review' (unchanged)
   classification: 'duplicate'
   outcome: 'forwarded'
   → LeadBadge: "Forwarded"
```

**Key Points:**
- Went to human review due to low confidence
- Autonomy stays `'review'` forever (preserves record of human involvement)
- Outcome changes from `'pending'` → `'forwarded'`

---

### Example 3: Quality Lead (Happy Path)

**Flow:**
```
1. Lead submitted
   autonomy: null
   classification: null
   outcome: null
   → LeadBadge: "Processing"

2. AI classifies as quality with 92% confidence
   Configuration: autoSendQualityThreshold = 0.95
   Decision: 92% < 95% → needs review

3. Workflow completes
   autonomy: 'review'
   classification: 'quality'
   outcome: 'pending'
   → LeadBadge: "Review"

4. Human approves, email sent
   autonomy: 'review' (unchanged)
   classification: 'quality'
   outcome: 'sent'
   → LeadBadge: "Sent"
```

---

### Example 4: Quality Lead Rejected by Human

**Flow:**
```
1-3. Same as Example 3

4. Human rejects (decides it's not actually quality)
   autonomy: 'review' (unchanged)
   classification: 'quality' (unchanged - AI still thought it was quality)
   outcome: 'dead'
   → LeadBadge: "Dead"
```

**Key Points:**
- Classification stays `'quality'` even though human disagreed
- This is valuable data: AI classified as quality but human said no
- Helps measure AI accuracy

---

### Example 5: Auto-Rejected Low-Value Lead

**Flow:**
```
1. Lead submitted
   autonomy: null
   classification: null
   outcome: null

2. AI classifies as low-value with 96% confidence
   Configuration: autoRejectLowValueThreshold = 0.90
   Decision: 96% >= 90% → auto-reject

3. Workflow completes
   autonomy: 'auto'
   classification: 'low-value'
   outcome: 'dead'
   → LeadBadge: "Dead"
```

**Key Points:**
- Never goes to human review
- Saves human time on obvious spam
- Autonomy is `'auto'` (system decided)

---

### Example 6: Workflow Error

**Flow:**
```
1. Lead submitted
   autonomy: null
   classification: null
   outcome: null
   → LeadBadge: "Processing"

2. Workflow fails (API error, timeout, etc.)
   autonomy: null (never got to decision)
   classification: null (never got to classification)
   outcome: 'error'
   → LeadBadge: "Error"
```

**Key Points:**
- Error is a terminal outcome
- Requires manual intervention (reclassify action)
- Autonomy and classification may be null

---

## Migration Strategy

### Database Migration

**Action:** Delete existing leads collection, start fresh

**Why:**
- Clean break is simpler than complex migration
- Dataset is small enough to regenerate test data
- Avoids maintaining dual systems

**New Schema:**
```typescript
interface Lead {
  autonomy: 'review' | 'auto' | null;
  classification: 'quality' | 'support' | 'duplicate' | 'low-value' | 'dead' | 'uncertain' | null;
  outcome: 'pending' | 'sent' | 'dead' | 'forwarded' | 'error' | null;
  // Remove: status field
  // ... other fields unchanged
}
```

---

## Implementation Plan

### Phase 1: Type Definitions & Config
1. Update `lib/types.ts` - Remove `LeadStatus`, add `autonomy` and `outcome` fields
2. Update Configuration type - Add threshold fields for all classifications
3. Rewrite `lib/statuses.ts` for new model
4. Create `lib/classifications.ts` for centralized classification colors

### Phase 2: Workflow Updates
1. Update workflow to return `{ autonomy, outcome }` instead of status
2. Add threshold checks for ALL classifications
3. Fix type bug (remove `'rejected'` return value)
4. Update API routes to use new fields

### Phase 3: Component Updates
1. Rename `ActionBadge` → `LeadBadge`
2. Update LeadBadge logic for new model
3. Remove Classification column from AllLeads
4. Update all components importing ActionBadge
5. Update StatusBadge to use `outcome` field

### Phase 4: Cleanup
1. Delete 5 obsolete components (ReviewQueue, SentEmails, etc.)
2. Extract shared ClassificationIcon component
3. Centralize classification colors
4. Update all hardcoded colors to use centralized config

### Phase 5: Testing & Validation
1. Test all threshold scenarios
2. Verify LeadBadge displays correctly for all states
3. Test human actions (approve, reject, forward, reclassify)
4. Verify analytics queries work with new model

---

## Benefits

### 1. Clear Separation of Concerns
- **Autonomy** = WHO decided
- **Classification** = WHAT the AI thinks
- **Outcome** = WHAT happened

Each field has a single, clear purpose.

### 2. Better Analytics
Can answer questions like:
- "What % of leads are auto-processed?"
- "Which classifications most often need human review?"
- "How accurate is the AI? (classification vs final outcome)"

### 3. Flexible Automation
Config-driven thresholds for all classifications allow:
- Gradual rollout of automation
- Different thresholds per classification type
- Easy tuning without code changes

### 4. Cleaner UI
- Remove redundant classification badge
- Single LeadBadge shows what user needs to know
- Less visual clutter, more actionable

### 5. Type Safety
- No more status values that don't exist in the type
- Clear states with immutability guarantees
- Better IntelliSense and compile-time checks

### 6. Historical Record
- Autonomy field preserves record of human involvement
- Can track automation effectiveness over time
- Audit trail for compliance

---

## Risks & Mitigations

### Risk 1: Breaking Change
**Mitigation:** Clean break with data deletion (user approved)

### Risk 2: Complex Migration
**Mitigation:** Fresh start eliminates migration complexity

### Risk 3: Learning Curve
**Mitigation:** Clear documentation, consistent naming, simpler model

### Risk 4: Missed Edge Cases
**Mitigation:** Comprehensive testing plan, examples document

---

## Success Criteria

1. ✅ All leads have `autonomy`, `classification`, `outcome` fields (no `status`)
2. ✅ All classifications have configurable thresholds
3. ✅ LeadBadge displays correctly for all states
4. ✅ No UI shows redundant classification badge
5. ✅ Obsolete components deleted
6. ✅ Classification colors centralized
7. ✅ All tests passing
8. ✅ Documentation complete

---

## Next Steps

1. Review this document with team
2. Get approval on design decisions
3. Implement Phase 1 (types & config)
4. Implement remaining phases sequentially
5. Test thoroughly
6. Deploy

---

## Questions / Concerns

*Document any remaining questions or concerns here*

---

**Document Version:** 1.0
**Last Updated:** 2025-01-20
**Authors:** Development Team

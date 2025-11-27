# Status Filter Refactor

**Date:** 2025-01-24
**Components:** AllLeads.tsx, LeadBadge.tsx, status-labels.ts

---

## Overview

Refactored the All Leads page filter from raw `outcome`-based filtering to user-centric **Status Label** filtering that combines `outcome` + `classification` to match what users actually see in badges.

---

## Problems Solved

### 1. **Outcome Filter Was Too Technical**
- Old filter showed raw outcome values (pending, sent_meeting_offer, etc.)
- Didn't match what users see in the UI (Reply with Meeting, Confirm Support, etc.)
- Users had to understand internal data model to filter effectively

### 2. **Missing "All Outcomes" Checkbox**
- No quick way to select/deselect all outcomes
- Had to manually check/uncheck 8+ items

### 3. **Confusing Default State**
- Empty selection meant "show all" (confusing!)
- Checkboxes appeared unchecked by default even though all leads were visible

### 4. **No Visual Distinction for Completed Leads**
- Active leads (need action) and completed leads (done) looked identical
- Hard to focus on what requires attention

### 5. **Missing "needs_classification" Handler**
- LeadBadge.tsx had no case for `outcome === 'needs_classification'`
- All leads awaiting classification showed "Unknown" badge

### 6. **Poor Terminology**
- "Outcome" implied finality, but included non-final states like "pending"
- "Status" is clearer and more intuitive

---

## Solution: Status Label System

### New Architecture

Created a **Status Label** system (`lib/status-labels.ts`) that maps UI labels to filter conditions:

```typescript
interface StatusLabel {
  key: string;              // Unique identifier
  label: string;            // What user sees (e.g., "Reply with Meeting")
  color: string;            // Badge color
  category: 'active' | 'completed';
  matches: (lead: Lead) => boolean;  // Filter function
}
```

### 14 Status Labels (9 Active + 5 Completed)

**Active (Needs Human Action):**
1. **Reply with Meeting** - `pending + quality`
2. **Reply with Generic** - `pending + low-value`
3. **Confirm Support** - `pending + support`
4. **Confirm Duplicate** - `pending + duplicate`
5. **Confirm Dead** - `pending + (irrelevant or dead)`
6. **Review** - `pending + uncertain` *(note: may be unused in practice)*
7. **Pending** - `pending + no classification`
8. **Classify** - `needs_classification` outcome
9. **Error** - `error` outcome

**Completed (Terminal States):**
1. **Meeting Offer Sent** - `sent_meeting_offer`
2. **Generic Message Sent** - `sent_generic`
3. **Dead** - `dead`
4. **Forwarded to Account Team** - `forwarded_account_team`
5. **Forwarded to Support** - `forwarded_support`

---

## Changes Made

### 1. Created `lib/status-labels.ts`

New file containing:
- `StatusLabel` interface
- `STATUS_LABELS` array with all 14 labels
- `ACTIVE_STATUS_LABELS` and `COMPLETED_STATUS_LABELS` helper arrays
- `getStatusLabel()` and `getLeadStatusLabel()` helper functions

### 2. Updated `components/dashboard/AllLeads.tsx`

**Filter State:**
```typescript
// OLD
const [selectedOutcomes, setSelectedOutcomes] = useState<Set<string>>(new Set());

// NEW
const [selectedStatusLabels, setSelectedStatusLabels] = useState<Set<string>>(
  new Set(STATUS_LABELS.map(s => s.key))  // All checked by default
);
```

**Filter Logic:**
```typescript
// OLD - checked if outcome matches
if (!selectedOutcomes.has(outcomeKey)) return false;

// NEW - checks if lead matches any selected status label
const matchesAnyLabel = Array.from(selectedStatusLabels).some(labelKey => {
  const label = getStatusLabel(labelKey);
  return label?.matches(lead);
});
if (!matchesAnyLabel) return false;
```

**Dropdown UI:**
```tsx
<DropdownMenuContent>
  {/* Active Section */}
  <div className="text-xs font-semibold text-muted-foreground">
    Active
  </div>
  {ACTIVE_STATUS_LABELS.map(label => (
    <DropdownMenuCheckboxItem>
      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: label.color }} />
      {label.label}
    </DropdownMenuCheckboxItem>
  ))}

  <DropdownMenuSeparator />

  {/* Completed Section */}
  <div className="text-xs font-semibold text-muted-foreground">
    Completed
  </div>
  {COMPLETED_STATUS_LABELS.map(label => (
    // ... same as above
  ))}
</DropdownMenuContent>
```

**Button Display:**
```tsx
// OLD
<span>Outcome {selectedOutcomes.size}/{ACTIVE_OUTCOMES.length}</span>

// NEW
<span>Status {selectedStatusLabels.size}/{STATUS_LABELS.length}</span>
```

### 3. Fixed `components/shared/LeadBadge.tsx`

**Added missing handler:**
```typescript
// Needs classification - lead requires human to manually classify
if (outcome === 'needs_classification') {
  const colors = getOutcomeColors('needs_classification');
  return {
    label: 'Classify',
    bg: colors.background,
    text: colors.text,
    border: colors.border,
    icon: <AlertCircle className="h-3 w-3" />
  };
}
```

**Location:** Inserted after error check (line 50-60)

### 4. Visual Treatment Demo (Optional)

Added demo toggle to compare visual treatments for completed leads:

**Option A:** 50% opacity on entire row
**Option C:** Subtle gray background

Implemented with:
```typescript
const [demoOption, setDemoOption] = useState<'A' | 'C'>('A');

const isCompleted = lead.outcome &&
  isTerminalOutcome(lead.outcome) &&
  lead.outcome !== 'error';

const rowClassName = demoOption === 'A'
  ? `cursor-pointer hover:bg-[#000000] ${isCompleted ? 'opacity-50' : ''}`
  : `cursor-pointer ${isCompleted ? 'bg-[rgba(255,255,255,0.02)]' : 'hover:bg-[#000000]'}`;
```

---

## Benefits

### 1. **User-Centric Filtering**
- Filter by what you see ("Reply with Meeting") not internal fields ("pending")
- Matches mental model of the UI

### 2. **Granular Control**
- Separate "Reply with Meeting" from "Confirm Support"
- Can focus on specific action types

### 3. **Clear Organization**
- Active vs Completed sections make workflow obvious
- Easy to see what needs attention vs what's done

### 4. **Better Default State**
- All checkboxes checked by default = all leads visible
- Unchecking removes those types (intuitive)

### 5. **Better Terminology**
- "Status" is clearer than "Outcome"
- Reflects that it includes both active and terminal states

### 6. **No More "Unknown" Badges**
- All outcome states now have proper handlers
- Consistent UI across list and detail views

---

## Data Model Context

### Terminology Clarification

The system has three orthogonal fields:

1. **`classification`** - WHAT the AI thinks about the lead
   - Values: `quality`, `support`, `low-value`, `duplicate`, `dead`, `irrelevant`, `uncertain`, `null`
   - Set by AI during workflow
   - Can be overridden via "reclassify" action

2. **`outcome`** - WHAT happened to the lead (current state)
   - Values: `null`, `pending`, `needs_classification`, `sent_meeting_offer`, `sent_generic`, `dead`, `forwarded_account_team`, `forwarded_support`, `error`
   - Represents the disposition/action taken
   - Starts as `null` (processing), then becomes `pending` or terminal

3. **`autonomy`** - WHO made the decision
   - Values: `null`, `review`, `auto`
   - Preserves historical record of human involvement

### Why "Status" Not "Outcome"?

The field is called `outcome` in the database but includes non-final states:
- `null` - Processing (workflow running)
- `pending` - Awaiting decision (not an outcome yet)
- `needs_classification` - Needs classification (not an outcome yet)
- `error` - Failed (needs retry, not truly final)

Only these are true "outcomes":
- `sent_meeting_offer`, `sent_generic`, `dead`, `forwarded_account_team`, `forwarded_support`

Therefore, "Status" is more accurate terminology for the UI.

---

## Edge Cases & Notes

### "Review" Label May Be Unused

The "Review" status label (`pending + uncertain`) may never occur in practice:

**Why?**
1. AI classifies as `uncertain` → Routes to `needs_classification` outcome
2. Human must select a real classification (quality, support, low-value, duplicate, dead)
3. Humans never select "uncertain" as final classification

**Evidence:**
- Submit route: `if (isUncertain) { outcome = 'needs_classification' }`
- Classify route: Has `case 'uncertain'` but humans don't use it

**Recommendation:** Monitor usage. If truly unused, remove "Review" label in future cleanup.

### Processing State (`outcome = null`)

Not included in the status filter because it's transient:
- Leads only stay in this state for ~30 seconds while workflow runs
- Automatically transitions to `pending` or `needs_classification`
- Filtering by it would be confusing (results constantly changing)

### Error Is Active, Not Completed

Though technically "terminal" in the code (`isTerminal: true`), Error is grouped with "Active" statuses because:
- Requires human intervention to fix
- Needs action (retry, manual handling)
- Not truly "done" from a workflow perspective

---

## Files Changed

### Created
- **`lib/status-labels.ts`** - Status label system and filter logic

### Modified
- **`components/dashboard/AllLeads.tsx`** - Filter state, UI, and logic
- **`components/shared/LeadBadge.tsx`** - Added `needs_classification` handler

### Referenced
- **`lib/outcomes.ts`** - Outcome configurations and colors
- **`lib/types.ts`** - LeadOutcome and Lead type definitions

---

## Testing

### Scenarios to Verify

- [ ] All 14 status labels appear in dropdown with correct colors
- [ ] Active section shows 9 labels, Completed shows 5
- [ ] All checkboxes checked by default → all leads visible
- [ ] Unchecking "Classify" → hides needs_classification leads
- [ ] Unchecking "Reply with Meeting" → hides pending + quality leads
- [ ] "Status 14/14" updates to "Status X/14" when filtering
- [ ] Colored circles in button show first 3 selected labels
- [ ] Leads with `needs_classification` outcome show "Classify" badge (not "Unknown")
- [ ] Filter persists state during real-time Firestore updates
- [ ] Filter works correctly with date range + author filters

### Known Issues

None at this time.

---

## Future Improvements

### 1. Remove "Review" Label (if unused)
If confirmed that humans never classify as `uncertain`, remove this label:
- Update `STATUS_LABELS` array
- Update total count from 14 to 13
- Remove from documentation

### 2. Simplify Classify Route
If `uncertain` classification is never used, remove the case from `/api/leads/[id]/classify/route.ts`.

### 3. Indeterminate Checkbox State
Could add indeterminate state to section headers when some (but not all) labels in that section are selected.

### 4. Save Filter Preferences
Store selected status labels in localStorage to persist across sessions.

### 5. Quick Filters
Add preset buttons:
- "Needs My Attention" → Only active statuses
- "Completed Today" → Only completed + date filter
- "Quality Leads" → Only quality-related statuses

---

## Related Documentation

- `/docs/autonomy-classification-outcome.md` - Data model explanation
- `/docs/PLAN_human_classification_workflow.md` - Human classification workflow
- `/lib/outcomes.ts` - Outcome configurations
- `/lib/types.ts` - Type definitions

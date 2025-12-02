# Simplify Action Labels → Classification-Only Badges

## Summary

Replace action labels ("Reply with Meeting", "Forward Support") with classification labels ("High Quality", "Support") across the leads table. Remove the redundant Type column since the badge now shows classification.

## Current Table Layout

```
Company | Status  | Action Badge              | Type           | Date  | TTR
--------|---------|---------------------------|----------------|-------|----
Loom    | Classify| [⚠ Needs Classification] | ● High Quality | Nov 15| —
Split   | Review  | [→ Reply with Meeting]   | ● High Quality | Nov 14| —
Neon    | Done    | [✓ Meeting Offer Sent]   | ● High Quality | Nov 28| 8m
```

## New Table Layout

```
Company | Status  | Badge                    | Date  | TTR
--------|---------|--------------------------|-------|----
Loom    | Classify| [⚠ Needs Classification]| Nov 15| —
Split   | Review  | [● High Quality]         | Nov 14| —
Neon    | Done    | [✓ High Quality]         | Nov 28| 8m
```

## Files to Modify

### 1. `nextjs-app/components/shared/LeadBadge.tsx`

Update `getBadgeForLead()` function:

- **Lines 58-75 (done status):** Change from terminal state to classification label
- **Lines 104-118 (review status):** Change from `action.short` to classification label
- Remove unused imports: `getTerminalState`, `getTerminalStateDisplay`, `getClassificationAction`

**New logic:**
```typescript
// For done or review status with classification:
const classification = getCurrentClassification(lead);
if (classification) {
  const label = getClassificationLabel(classification);
  const variant = getVariantForClassification(classification);
  const icon = status === 'done' ? <Check /> : null;
  return { label, variant, icon };
}
```

### 2. `nextjs-app/components/dashboard/AllLeads.tsx`

Remove the Type column from the table:

- **Lines 370-385:** Delete the Classification TableCell entirely
- Keep the Type filter dropdown (still useful for filtering by classification)

## Implementation Steps

1. **LeadBadge.tsx changes:**
   - Simplify `done` status handling: use `getClassificationLabel()` + Check icon
   - Simplify `review` status handling: use `getClassificationLabel()` + no icon
   - Remove imports: `getTerminalState`, `getTerminalStateDisplay`, `getClassificationAction`
   - Remove `getVariantForTerminalState()` function

2. **AllLeads.tsx changes:**
   - Remove the Classification `<TableCell>` (lines 370-385)
   - Update `colSpan` in empty state row from 5 to 4

3. **types.ts cleanup:**
   - Remove `action` property from `ClassificationConfig` interface (lines 48-52)
   - Remove all `action: { short, long, color }` objects from `CLASSIFICATIONS` entries (7 places)
   - Remove `getClassificationAction()` function (lines 168-170)
   - Remove `getTerminalStateDisplay()` function (lines 425-428)

4. **Keep unchanged (used for analytics):**
   - `getTerminalState()` - used in analytics-helpers.ts and api/analytics/overview
   - `TERMINAL_STATES` config - used for analytics
   - `TerminalState` type - used for analytics
   - Type filter dropdown - still useful for filtering

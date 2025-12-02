# Reroute Data Model Migration Plan

## Problem

Currently, reroutes are handled by changing a lead's classification to values like `customer-reroute`, `support-reroute`, or `sales-reroute`. This is problematic because:

1. **Classifications have confidence scores** - Reroutes aren't AI predictions, they're feedback events
2. **Pollutes analytics** - Reroute "classifications" appear in classification breakdown charts
3. **Loses original data** - The original classification is overwritten, making it hard to track what went wrong
4. **Conceptual mismatch** - Reroutes are post-processing feedback, not classification decisions

## Solution

Separate reroutes into their own data structure, keeping classifications pure.

### New Data Model

```typescript
// Classification stays pure - only AI/human classification decisions
type Classification = 'high-quality' | 'low-quality' | 'support' | 'duplicate';

// New reroute source type
type RerouteSource = 'customer' | 'support' | 'sales';

// New Reroute interface
interface Reroute {
  id: string;
  source: RerouteSource;
  reason?: string;
  originalClassification: Classification;
  previousTerminalState?: TerminalState;  // What was sent before reroute (if any)
  timestamp: Date | Timestamp;
}

// Updated Lead interface
interface Lead {
  // ... existing fields ...
  classifications: ClassificationEntry[];  // Pure classifications only
  reroute?: Reroute;                        // NEW: Single optional reroute
}
```

### Reroute Flow

1. Lead is classified (e.g., as `support`) and sent to support team
2. `terminalState` is set to `forwarded_support`
3. Support team disagrees and submits feedback
4. A reroute entry is set: `{ source: 'support', originalClassification: 'support', previousTerminalState: 'forwarded_support', ... }`
5. `terminalState` is cleared (lead acts like it was never sent)
6. Lead status set back to `review`
7. Human reviews and can either reclassify or mark as done (no forced reclassification)

This preserves the complete timeline: you can see what was originally sent, who rerouted it, why, and what happened after.

**Note:** Only one reroute per lead is supported. If a lead needs to be rerouted again, this would indicate a deeper process issue.

---

## Files to Modify

### Phase 1: Type Definitions

#### `nextjs-app/lib/types.ts`

**Lines 9-16 - Classification type:**
```typescript
// BEFORE
type Classification =
  | 'high-quality' | 'low-quality' | 'support' | 'duplicate'
  | 'customer-reroute' | 'support-reroute' | 'sales-reroute';

// AFTER
type Classification = 'high-quality' | 'low-quality' | 'support' | 'duplicate';
```

**Lines 26-33 - TerminalState type:**
```typescript
// BEFORE
type TerminalState =
  | 'sent_meeting_offer' | 'sent_generic' | 'forwarded_support' | 'forwarded_account_team'
  | 'customer_reroute' | 'support_reroute' | 'sales_reroute';

// AFTER
type TerminalState =
  | 'sent_meeting_offer' | 'sent_generic' | 'forwarded_support' | 'forwarded_account_team';
```

**Lines 55-161 - CLASSIFICATIONS config:**
- Remove entries for `customer-reroute`, `support-reroute`, `sales-reroute` (lines 116-160)

**Lines 186-250 - TERMINAL_STATES config:**
- Remove entries for `customer_reroute`, `support_reroute`, `sales_reroute` (lines 223-250)

**Lines 268-367 - Lead interface:**
- Add `reroute?: Reroute;` field (single optional reroute, not an array)

**New types to add:**
```typescript
export type RerouteSource = 'customer' | 'support' | 'sales';

export interface Reroute {
  id: string;
  source: RerouteSource;
  reason?: string;
  originalClassification: Classification;
  previousTerminalState?: TerminalState;
  timestamp: Date | Timestamp;
}
```

**Lines 374-389 - getTerminalState():**
- Remove the three reroute cases from the switch statement

**Lines 414-423 - TYPE_FILTER_OPTIONS:**
- Remove the three reroute filter options

#### `mcp-server-inbound/src/index.ts`

**Lines 44-50 - Classification type:**
- Remove `customer-reroute`, `support-reroute`, `sales-reroute` (currently has stale `internal-reroute`)

**Lines 124-144 - Lead interface:**
- Add `reroute` field with `Reroute` type (single optional, not array)

---

### Phase 2: Feedback Endpoint (Core Reroute Logic)

#### `nextjs-app/app/feedback/[id]/[source]/actions.ts`

**Lines 69-104 - submitFeedback() logic:**

```typescript
// BEFORE - Creates classification entry
const classificationTypeMap: Record<string, Classification> = {
  customer: 'customer-reroute',
  support: 'support-reroute',
  sales: 'sales-reroute',
};
const newClassification: ClassificationEntry = {
  author: source === 'customer' ? 'customer' : 'internal',
  classification: classificationTypeMap[source],
  timestamp: now,
};
const updatedClassifications = [newClassification, ...existingClassifications];

await adminDb.collection('leads').doc(leadId).update({
  classifications: updatedClassifications,
  'status.status': newStatus,
  edit_note: noteContent,
});

// AFTER - Creates single reroute entry
const currentClassification = lead.classifications[0]?.classification;
if (!currentClassification) {
  return { success: false, error: 'Lead has no classification to reroute from' };
}

const currentTerminalState = getTerminalState(lead);

const reroute: Reroute = {
  id: crypto.randomUUID(),
  source: source as RerouteSource,
  reason: reason?.trim() || undefined,
  originalClassification: currentClassification,
  previousTerminalState: currentTerminalState || undefined,
  timestamp: now,
};

await adminDb.collection('leads').doc(leadId).update({
  reroute,
  'status.status': newStatus,
  terminalState: admin.firestore.FieldValue.delete(),  // Clear - act like never sent
});
```

#### `nextjs-app/app/api/leads/[id]/feedback/route.ts`

**DELETE THIS FILE** - It's unused (dead code). The Server Action in `actions.ts` handles all feedback submissions via the `FeedbackForm` component. No external API consumers exist.

---

### Phase 3: Helper Functions

#### `nextjs-app/lib/configuration-helpers.ts`

**Lines 154-162 - getThresholdForClassification():**
- Remove the three reroute cases entirely (they returned 0)

---

### Phase 4: Analytics

#### `nextjs-app/app/api/analytics/overview/route.ts`

**Lines 55-68 - AnalyticsData interface:**
- Remove reroute keys from `classificationBreakdown` type

**Lines 117-143 - Terminal state counting:**
```typescript
// BEFORE - Counts reroutes from terminal states
case "customer_reroute": customerReroutes++; break;
case "support_reroute": supportReroutes++; break;
case "sales_reroute": salesReroutes++; break;

// AFTER - Count from single reroute field
leads.forEach((lead) => {
  if (lead.reroute) {
    if (lead.reroute.source === 'customer') customerReroutes++;
    else if (lead.reroute.source === 'support') supportReroutes++;
    else if (lead.reroute.source === 'sales') salesReroutes++;
  }
});
```

**Lines 148-164 - Classification breakdown:**
- Remove reroute classifications from the breakdown object
- Rerouted leads are excluded from classification breakdown (they represent misclassifications)

#### `nextjs-app/lib/analytics-helpers.ts`

**Lines 322-341 - getClassificationBreakdown():**
- Remove reroute classifications from breakdown object
- Exclude leads with `reroute` field from classification counts

**Lines 346-374 - getConfidenceByClassification():**
- Remove reroute classifications from grouped object
- Exclude rerouted leads from confidence calculations

---

### Phase 5: UI Components

#### `nextjs-app/components/shared/LeadBadge.tsx`

**Lines 18-29 - getVariantForClassification():**
- Remove cases for `customer-reroute`, `support-reroute`, `sales-reroute`

**Lines 34-45 - getVariantForTerminalState():**
- Remove cases for reroute terminal states

**Lines 55-127 - getBadgeForLead():**
- Add new case for leads with a reroute that are back in review:
```typescript
if (lead.reroute && lead.status.status === 'review') {
  return {
    label: 'Rerouted',
    variant: 'warning',
    icon: <AlertCircle className="h-3 w-3" />
  };
}
```

#### `nextjs-app/components/dashboard/AllLeads.tsx`

**Lines 44-46, 84-86 - Filter logic:**
- Remove reroute classification filter options (they no longer exist as classifications)

#### `nextjs-app/app/dashboard/leads/[id]/page.tsx`

- Add display of reroute info on lead detail page (if `lead.reroute` exists)
- Show source, timestamp, reason, and previousTerminalState
- This creates a complete timeline when combined with classification history

---

### Phase 6: Dashboard Analytics Page

#### `nextjs-app/app/dashboard/analytics/page.tsx`

**Lines 432-449 - Classification Breakdown:**
- Remove the three reroute ClassificationBar entries

**Lines 461-474 - Confidence by Classification:**
- Reroutes will naturally be excluded since they won't be in the data

---

### Phase 7: Test Data

#### `nextjs-app/lib/db/generated-leads.json`

- Delete all existing leads and regenerate fresh
- Update mock data generator to use new `reroute` field instead of reroute classifications

**Note:** No data migration is needed. All existing leads in the database will be deleted before this migration. This is acceptable for the current stage of the project.

---

## Execution Order

1. **Type definitions** - Update types.ts and MCP server types
2. **Add Reroute interface** - New type with `previousTerminalState` field
3. **Update Lead interface** - Add optional `reroutes` field
4. **Update feedback endpoints** - Create reroutes instead of classification changes, clear terminalState
5. **Update helper functions** - Remove reroute classification handling
6. **Update analytics** - New counting logic for reroutes
7. **Update UI components** - Display changes, add reroute timeline
8. **Regenerate test data** - Fresh data with new format

---

## Benefits After Migration

1. **Clean classification data** - Only real classifications in breakdown charts
2. **Preserved history** - Original classification kept when reroute occurs
3. **Complete timeline** - `previousTerminalState` captures what was sent before reroute
4. **Better analytics** - Can answer "what % of support classifications get rerouted?"
5. **Correct confidence handling** - Reroutes don't pollute confidence metrics
6. **Clearer data model** - Classifications = predictions, Reroutes = feedback events

---

## Data Migration

**No migration needed.** All existing leads in the database will be deleted before this migration. This avoids the complexity of converting old reroute classifications to the new format.

---

## Files Summary

| File | Changes |
|------|---------|
| `lib/types.ts` | Remove 3 classification types, add Reroute interface, update Lead interface with single `reroute?` field |
| `mcp-server-inbound/src/index.ts` | Sync types with main app (remove stale internal-reroute, add reroute field) |
| `app/feedback/[id]/[source]/actions.ts` | Create single reroute instead of classification, clear terminalState |
| `app/api/leads/[id]/feedback/route.ts` | **DELETE** (unused dead code) |
| `lib/configuration-helpers.ts` | Remove reroute threshold cases |
| `app/api/analytics/overview/route.ts` | New reroute counting logic (single field) |
| `lib/analytics-helpers.ts` | Remove reroute classifications from breakdown |
| `components/shared/LeadBadge.tsx` | Remove reroute badge cases, add "Rerouted" badge |
| `components/dashboard/AllLeads.tsx` | Remove reroute filter options |
| `app/dashboard/leads/[id]/page.tsx` | Display reroute info on detail page |
| `app/dashboard/analytics/page.tsx` | Remove reroute bars from breakdown |
| `lib/db/generated-leads.json` | Regenerate fresh |

**Total: 11 files modified, 1 file deleted**

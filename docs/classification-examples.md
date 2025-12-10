# Classification Examples Feature

Add a system for SDRs to contribute training examples that improve AI classification accuracy.

## Overview

When a lead is marked "done", an "Improve our AI" section appears on the lead detail page where SDRs can explain why the classification is correct. These examples are stored, reviewed on a simple examples page, and injected into classification prompts as few-shot examples.

## Data Model

### New Types (add to `lib/types.ts`)

```typescript
export type ExampleStatus = 'active' | 'inactive';

export interface ClassificationExample {
  id: string;
  lead_snapshot: {
    submission: { leadName: string; email: string; company: string; message: string; };
    research_report: string;
  };
  classification: Classification;
  sdr_reasoning: string;
  status: ExampleStatus;
  source_lead_id: string;
  created_by: string;
  created_at: Date | Timestamp;
  updated_at: Date | Timestamp;
}
```

### Firestore Collection: `examples`

## Implementation Steps

### Phase 1: Foundation

1. **Add types** to `lib/types.ts`
   - `ExampleStatus`, `ClassificationExample`

2. **Create examples service** `lib/examples-service.ts`
   - `createExample(leadId, sdrReasoning)` - creates example from lead data
   - `getExamples()` - list all examples
   - `updateExampleStatus(id, status)` - activate/deactivate
   - `getActiveExamples()` - fetch active examples for injection
   - `formatExamplesForPrompt(examples)` - format as few-shot examples

### Phase 2: API Routes

3. **Create** `app/api/examples/route.ts`
   - `GET` - list all examples
   - `POST` - create example from `{ lead_id, sdr_reasoning }`

4. **Create** `app/api/examples/[id]/route.ts`
   - `PATCH` - update status (activate/deactivate)
   - `DELETE` - remove example

### Phase 3: "Improve our AI" Section on Lead Page

5. **Create** `components/dashboard/ImproveAISection.tsx`
   - Section component (like other sections on lead detail page)
   - Only shows when `status === 'done'`
   - Textarea for SDR reasoning
   - Submit button to create example
   - Shows success state after submission

6. **Integrate into** `app/dashboard/leads/[id]/page.tsx`
   - Add `ImproveAISection` component after other sections
   - Only render when lead status is "done"

### Phase 4: Examples Page

7. **Create** `app/dashboard/examples/page.tsx`
   - Simple table listing all examples
   - Columns: company, classification badge, status badge, created_at
   - Expandable rows showing full details (message, research, reasoning)
   - Toggle button to activate/deactivate each example
   - Delete button for each example

8. **Update** `app/dashboard/layout.tsx`
   - Add "Examples" tab to navItems
   - Add to TabValue type

### Phase 5: Prompt Injection

9. **Modify** `lib/workflow-services.ts` `qualifyLead()`
   - Fetch active examples (max 5)
   - Inject formatted examples before lead info in classification prompt
   - Format:
     ```
     VERIFIED EXAMPLES:

     Example 1:
     Lead: [Name] at [Company]
     Message: [message]
     Research: [truncated research]
     Classification: [classification]
     Why: [sdr_reasoning]
     ---
     ```

## Files to Create

| File | Purpose |
|------|---------|
| `lib/examples-service.ts` | Business logic for examples CRUD |
| `app/api/examples/route.ts` | List/create examples API |
| `app/api/examples/[id]/route.ts` | Update/delete example API |
| `components/dashboard/ImproveAISection.tsx` | Section on lead page for feedback |
| `app/dashboard/examples/page.tsx` | Examples management page |

## Files to Modify

| File | Changes |
|------|---------|
| `lib/types.ts` | Add example types |
| `lib/workflow-services.ts` | Inject examples into qualifyLead prompt |
| `app/dashboard/leads/[id]/page.tsx` | Add ImproveAISection when done |
| `app/dashboard/layout.tsx` | Add Examples tab |

## Design Decisions

- **No modal** - simple Section component on lead page (consistent with existing UX)
- **No filters on examples page** - simple table with all examples
- **No prompt type enum** - classification only for now
- **Max 5 examples** injected (to manage token count)
- **Newest first** ordering
- **Inactive by default** (admin activates good examples)

# Type Consolidation Plan

## Problem

The codebase has multiple files defining the same concepts (classifications, colors, labels, terminal states) leading to:
- Maintenance burden (update in multiple places)
- Risk of drift between definitions
- Confusion about which is the "source of truth"

## Current State

| Concept | Defined In | Notes |
|---------|-----------|-------|
| `Classification` type | `lib/types.ts:8-13` | Canonical |
| `LeadStatus` type | `lib/types.ts:16` | Canonical |
| `TerminalState` type | `lib/types.ts:113-118` | Canonical |
| Classification colors | `lib/classifications.ts`, `lib/outcomes.ts`, `lib/action-labels.ts`, `lib/status-labels.ts` | 4 duplicates |
| Classification labels | `lib/classifications.ts`, `lib/action-labels.ts`, `lib/status-labels.ts` | 3 duplicates |
| Terminal state colors | `lib/outcomes.ts`, `lib/status-labels.ts` | 2 duplicates |
| Terminal state labels | `lib/status-labels.ts` | 1 location |
| Legacy types | `lib/types.ts:391-414` | Should be removed |

## Proposed Structure

Consolidate everything into a single `lib/types.ts` file:

```
lib/types.ts
├── ENUMS
│   ├── Classification (type)
│   ├── LeadStatus (type)
│   └── TerminalState (type)
│
├── CLASSIFICATION CONFIG (single source of truth)
│   ├── CLASSIFICATIONS record
│   │   ├── key
│   │   ├── label (display name)
│   │   ├── description
│   │   ├── colors { text, background, border }
│   │   └── action { short, long } (what to do with this classification)
│   └── Helper functions
│       ├── getClassificationLabel()
│       ├── getClassificationColors()
│       └── getClassificationAction()
│
├── TERMINAL STATE CONFIG (single source of truth)
│   ├── TERMINAL_STATES record
│   │   ├── key
│   │   ├── label
│   │   └── colors { text, background, border }
│   └── Helper functions
│       ├── getTerminalStateLabel()
│       └── getTerminalStateColors()
│
├── STATUS LABELS (for UI filtering)
│   ├── STATUS_LABELS array
│   └── Helper functions
│       ├── getStatusLabel()
│       └── getLeadStatusLabel()
│
├── DATA MODEL INTERFACES
│   ├── Submission
│   ├── BotResearch
│   ├── BotText
│   ├── BotRollout
│   ├── HumanEdits
│   ├── StatusInfo
│   ├── ClassificationEntry
│   ├── Lead
│   └── Configuration
│
├── DERIVED STATE FUNCTIONS
│   ├── getTerminalState()
│   ├── getCurrentClassification()
│   ├── wasReclassified()
│   └── needsReview()
│
└── ANALYTICS TYPES
    ├── AnalyticsEventType
    ├── AnalyticsEvent
    └── ConfigurationMetrics (cleaned up)
```

## Files to Delete After Consolidation

| File | Reason |
|------|--------|
| `lib/classifications.ts` | Merged into `lib/types.ts` |
| `lib/outcomes.ts` | Already deprecated, merged into `lib/types.ts` |
| `lib/action-labels.ts` | Merged into `lib/types.ts` |
| `lib/status-labels.ts` | Merged into `lib/types.ts` |

## Migration Steps

### Step 1: Expand `lib/types.ts`

Add to `lib/types.ts`:

```typescript
// =============================================================================
// CLASSIFICATION CONFIG (single source of truth for display)
// =============================================================================

export interface ClassificationConfig {
  key: Classification;
  label: string;
  description: string;
  colors: {
    text: string;
    background: string;
    border: string;
  };
  action: {
    short: string;  // Badge text (e.g., "Reply with Meeting")
    long: string;   // Button text (e.g., "Reply with Meeting")
  };
}

export const CLASSIFICATIONS: Record<Classification, ClassificationConfig> = {
  'high-quality': {
    key: 'high-quality',
    label: 'High Quality',
    description: 'High-value lead with clear product-market fit',
    colors: {
      text: '#22c55e',
      background: 'rgba(34, 197, 94, 0.1)',
      border: 'rgba(34, 197, 94, 0.2)',
    },
    action: {
      short: 'Reply with Meeting',
      long: 'Reply with Meeting',
    },
  },
  'low-quality': {
    key: 'low-quality',
    label: 'Low Quality',
    description: 'Real opportunity but not a good fit for personalized outreach',
    colors: {
      text: '#a1a1a1',
      background: 'rgba(161, 161, 161, 0.1)',
      border: 'rgba(161, 161, 161, 0.2)',
    },
    action: {
      short: 'Reply with Generic',
      long: 'Reply with Generic',
    },
  },
  support: {
    key: 'support',
    label: 'Support',
    description: 'Existing customer with support request',
    colors: {
      text: '#3b82f6',
      background: 'rgba(59, 130, 246, 0.1)',
      border: 'rgba(59, 130, 246, 0.2)',
    },
    action: {
      short: 'Forward Support',
      long: 'Forward to Support',
    },
  },
  duplicate: {
    key: 'duplicate',
    label: 'Duplicate',
    description: 'Duplicate submission from existing customer',
    colors: {
      text: '#a855f7',
      background: 'rgba(168, 85, 247, 0.1)',
      border: 'rgba(168, 85, 247, 0.2)',
    },
    action: {
      short: 'Forward Duplicate',
      long: 'Forward to Account Team',
    },
  },
  irrelevant: {
    key: 'irrelevant',
    label: 'Irrelevant',
    description: 'Spam, test submission, or otherwise irrelevant',
    colors: {
      text: '#a1a1a1',
      background: 'rgba(161, 161, 161, 0.1)',
      border: 'rgba(161, 161, 161, 0.2)',
    },
    action: {
      short: 'Mark Dead',
      long: 'Mark Dead',
    },
  },
};

// Helper functions
export function getClassificationConfig(c: Classification): ClassificationConfig {
  return CLASSIFICATIONS[c];
}

export function getClassificationLabel(c: Classification): string {
  return CLASSIFICATIONS[c].label;
}

export function getClassificationColors(c: Classification) {
  return CLASSIFICATIONS[c].colors;
}

export function getClassificationAction(c: Classification) {
  return CLASSIFICATIONS[c].action;
}

// =============================================================================
// TERMINAL STATE CONFIG (single source of truth for display)
// =============================================================================

export interface TerminalStateConfig {
  key: TerminalState;
  label: string;
  colors: {
    text: string;
    background: string;
    border: string;
  };
}

export const TERMINAL_STATES: Record<TerminalState, TerminalStateConfig> = {
  sent_meeting_offer: {
    key: 'sent_meeting_offer',
    label: 'Meeting Offer Sent',
    colors: {
      text: '#22c55e',
      background: 'rgba(34, 197, 94, 0.1)',
      border: 'rgba(34, 197, 94, 0.2)',
    },
  },
  sent_generic: {
    key: 'sent_generic',
    label: 'Generic Message Sent',
    colors: {
      text: '#a1a1a1',
      background: 'rgba(161, 161, 161, 0.1)',
      border: 'rgba(161, 161, 161, 0.2)',
    },
  },
  forwarded_support: {
    key: 'forwarded_support',
    label: 'Forwarded to Support',
    colors: {
      text: '#3b82f6',
      background: 'rgba(59, 130, 246, 0.1)',
      border: 'rgba(59, 130, 246, 0.2)',
    },
  },
  forwarded_account_team: {
    key: 'forwarded_account_team',
    label: 'Forwarded to Account Team',
    colors: {
      text: '#a855f7',
      background: 'rgba(168, 85, 247, 0.1)',
      border: 'rgba(168, 85, 247, 0.2)',
    },
  },
  dead: {
    key: 'dead',
    label: 'Dead',
    colors: {
      text: '#a1a1a1',
      background: 'rgba(161, 161, 161, 0.1)',
      border: 'rgba(161, 161, 161, 0.2)',
    },
  },
};

// Helper functions
export function getTerminalStateConfig(s: TerminalState): TerminalStateConfig {
  return TERMINAL_STATES[s];
}

export function getTerminalStateLabel(s: TerminalState): string {
  return TERMINAL_STATES[s].label;
}

export function getTerminalStateColors(s: TerminalState) {
  return TERMINAL_STATES[s].colors;
}

// =============================================================================
// STATUS LABELS (for UI filtering)
// =============================================================================

export interface StatusLabel {
  key: string;
  label: string;
  color: string;
  category: 'active' | 'completed';
  matches: (lead: Lead) => boolean;
}

export const STATUS_LABELS: StatusLabel[] = [
  // Active (status = 'review')
  {
    key: 'reply_meeting',
    label: CLASSIFICATIONS['high-quality'].action.short,
    color: CLASSIFICATIONS['high-quality'].colors.text,
    category: 'active',
    matches: (lead) => lead.status?.status === 'review' && getCurrentClassification(lead) === 'high-quality',
  },
  {
    key: 'reply_generic',
    label: CLASSIFICATIONS['low-quality'].action.short,
    color: CLASSIFICATIONS['low-quality'].colors.text,
    category: 'active',
    matches: (lead) => lead.status?.status === 'review' && getCurrentClassification(lead) === 'low-quality',
  },
  {
    key: 'forward_support',
    label: CLASSIFICATIONS['support'].action.short,
    color: CLASSIFICATIONS['support'].colors.text,
    category: 'active',
    matches: (lead) => lead.status?.status === 'review' && getCurrentClassification(lead) === 'support',
  },
  {
    key: 'forward_duplicate',
    label: CLASSIFICATIONS['duplicate'].action.short,
    color: CLASSIFICATIONS['duplicate'].colors.text,
    category: 'active',
    matches: (lead) => lead.status?.status === 'review' && getCurrentClassification(lead) === 'duplicate',
  },
  {
    key: 'mark_dead',
    label: CLASSIFICATIONS['irrelevant'].action.short,
    color: '#ef4444', // red for action needed
    category: 'active',
    matches: (lead) => lead.status?.status === 'review' && getCurrentClassification(lead) === 'irrelevant',
  },
  {
    key: 'classify',
    label: 'Needs Classification',
    color: '#f59e0b',
    category: 'active',
    matches: (lead) => lead.status?.status === 'review' && (!lead.classifications || lead.classifications.length === 0),
  },

  // Completed (status = 'done')
  {
    key: 'sent_meeting',
    label: TERMINAL_STATES.sent_meeting_offer.label,
    color: TERMINAL_STATES.sent_meeting_offer.colors.text,
    category: 'completed',
    matches: (lead) => getTerminalState(lead) === 'sent_meeting_offer',
  },
  {
    key: 'sent_generic',
    label: TERMINAL_STATES.sent_generic.label,
    color: TERMINAL_STATES.sent_generic.colors.text,
    category: 'completed',
    matches: (lead) => getTerminalState(lead) === 'sent_generic',
  },
  {
    key: 'dead',
    label: TERMINAL_STATES.dead.label,
    color: TERMINAL_STATES.dead.colors.text,
    category: 'completed',
    matches: (lead) => getTerminalState(lead) === 'dead',
  },
  {
    key: 'forwarded_account',
    label: TERMINAL_STATES.forwarded_account_team.label,
    color: TERMINAL_STATES.forwarded_account_team.colors.text,
    category: 'completed',
    matches: (lead) => getTerminalState(lead) === 'forwarded_account_team',
  },
  {
    key: 'forwarded_support',
    label: TERMINAL_STATES.forwarded_support.label,
    color: TERMINAL_STATES.forwarded_support.colors.text,
    category: 'completed',
    matches: (lead) => getTerminalState(lead) === 'forwarded_support',
  },
];

export const ACTIVE_STATUS_LABELS = STATUS_LABELS.filter(s => s.category === 'active');
export const COMPLETED_STATUS_LABELS = STATUS_LABELS.filter(s => s.category === 'completed');

export function getStatusLabel(key: string): StatusLabel | undefined {
  return STATUS_LABELS.find(s => s.key === key);
}

export function getLeadStatusLabel(lead: Lead): StatusLabel | undefined {
  return STATUS_LABELS.find(s => s.matches(lead));
}
```

### Step 2: Remove Legacy Types

Delete from `lib/types.ts`:
- `LegacyClassification` type
- `LegacyOutcome` type
- `LegacyAutonomy` type
- `mapLegacyClassification()` function

### Step 3: Fix `ConfigurationMetrics`

Change `classification_breakdown` to only use new classification names:

```typescript
classification_breakdown: {
  'high-quality': number;
  'low-quality': number;
  support: number;
  duplicate: number;
  irrelevant: number;
};
```

### Step 4: Update Imports Across Codebase

Find all imports from deleted files and update to `lib/types.ts`:

```bash
# Files importing from lib/classifications.ts
nextjs-app/components/shared/LeadBadge.tsx  # Currently unused - can delete import
nextjs-app/lib/status-labels.ts             # Will be deleted

# Files importing from lib/action-labels.ts
nextjs-app/components/shared/LeadBadge.tsx
nextjs-app/lib/status-labels.ts             # Will be deleted

# Files importing from lib/outcomes.ts
nextjs-app/lib/status-labels.ts             # Will be deleted

# Files importing from lib/status-labels.ts
nextjs-app/components/shared/LeadBadge.tsx
nextjs-app/components/dashboard/AllLeads.tsx
nextjs-app/components/dashboard/LeadsPageClient.tsx
```

### Step 5: Delete Redundant Files

```bash
rm nextjs-app/lib/classifications.ts
rm nextjs-app/lib/outcomes.ts
rm nextjs-app/lib/action-labels.ts
rm nextjs-app/lib/status-labels.ts
```

## Validation Checklist

After consolidation:
- [ ] `npm run build` succeeds
- [ ] All badge colors render correctly
- [ ] Lead filtering works
- [ ] Analytics page shows correct classification names
- [ ] No TypeScript errors
- [ ] No console warnings about missing imports

## Benefits

1. **Single source of truth** - One place to update colors, labels, etc.
2. **Type safety** - All configs derive from the same enums
3. **Easier maintenance** - One file to understand
4. **No drift** - STATUS_LABELS uses CLASSIFICATIONS/TERMINAL_STATES directly
5. **Cleaner imports** - Everything from `@/lib/types`

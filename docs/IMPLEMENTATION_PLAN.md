# Implementation Plan: Email Configuration & Auto-Send Controls

## Overview
This document outlines the remaining phases for improving the email configuration system and adding auto-send controls.

---

## Phase 2: Proper Default Configuration

### Problem
New configurations should be initialized with complete default values from account settings, so they're ready to use immediately.

### Changes

#### 1. Create Account Settings Module
**File:** `lib/account-settings.ts`
```typescript
export const ACCOUNT_SETTINGS = {
  sdr: {
    name: "Ryan",
    email: "ryan@vercel.com"
  },
  defaultPrompts: {
    research: "...",
    qualification: "...",
    emailGeneration: "..."
  },
  defaultThresholds: {
    quality: 0.7,
    support: 0.8,
    lowValue: 0.3,
    autoReject: 0.9
  }
};
```

#### 2. Update Configuration Initialization
**Files:**
- `app/api/configurations/route.ts` (create endpoint)
- `app/dashboard/configurations/new/page.tsx`

**Changes:**
- New configs auto-populate all fields from ACCOUNT_SETTINGS
- Email template includes SDR name/email from account
- All prompts initialized with defaults
- All thresholds set to default values

#### 3. Configuration Validation
**File:** `lib/config-validation.ts` (new)
```typescript
export function isConfigurationComplete(config: Configuration): boolean {
  // Validate email template
  const emailComplete = !!(
    config.emailTemplate?.subject &&
    config.emailTemplate?.greeting &&
    config.emailTemplate?.callToAction &&
    config.emailTemplate?.sdrName &&
    config.emailTemplate?.sdrEmail
  );

  // Validate prompts exist
  // Validate thresholds exist

  return emailComplete && promptsComplete && thresholdsComplete;
}
```

#### 4. Prevent Incomplete Configs
- Add validation before saving/activating configurations
- Show clear error messages indicating which fields are missing
- UI warnings if trying to activate incomplete config

---

## Phase 3: Auto-Send Percentage Control

### Problem
Need gradual rollout control for automated email sending. Users should be able to slowly increase automation as they gain confidence in the system.

### Changes

#### 1. Update Configuration Type
**File:** `lib/types.ts`
```typescript
export interface Configuration {
  // ... existing fields
  autoSendPercentage: number; // 0-100, default 0
}
```

#### 2. Implement in Workflow
**File:** `lib/workflow-services.ts`

After email generation, add decision logic:
```typescript
async function shouldAutoSend(config: Configuration): Promise<boolean> {
  const randomValue = Math.random() * 100;
  return randomValue <= config.autoSendPercentage;
}

// In email generation workflow:
if (await shouldAutoSend(configuration)) {
  // Auto-send: status = "sent"
  await updateLeadStatus(leadId, "sent");
} else {
  // Manual review: status = "review"
  await updateLeadStatus(leadId, "review");
}
```

#### 3. UI Controls
**Files:**
- `app/dashboard/configurations/[id]/page.tsx` (detail page)
- `app/dashboard/configurations/new/page.tsx` (edit page)

**Add to configuration detail/edit pages:**
- Slider or number input (0-100%)
- Default value: 0% for new configs
- Warning message if value > 50%
- Description: "Percentage of qualified leads that will automatically receive emails without manual review"

**Example UI:**
```
Auto-Send Percentage: [====------] 40%
⚠️ Warning: 40% of leads will be automatically sent without review
```

#### 4. Dashboard Updates
Show auto-send stats in configuration detail:
- "X% of leads auto-sent"
- "Last 10 leads: 4 auto-sent, 6 manual review"

---

## Phase 4: MCP Server Configuration Endpoints

### Problem
MCP server currently only exposes leads and case studies, but not configurations. This makes debugging and inspection difficult.

### Changes

#### 1. Add Configuration MCP Tools
**File:** `mcp-server/src/tools/configurations.ts` (or similar)

Add the following tools:

**`list_configurations`**
```typescript
{
  name: "mcp__inbound__list_configurations",
  description: "List all configurations with optional filtering",
  parameters: {
    status: "current" | "draft" | "archived" // optional filter
    full_details: boolean // default false, if true return all fields
  },
  returns: [
    {
      id: string,
      name: string,
      version: number,
      status: "current" | "draft" | "archived",
      activatedAt: string,
      isComplete: boolean, // based on validation
      emailTemplateConfigured: boolean
    }
  ]
}
```

**`get_configuration`**
```typescript
{
  name: "mcp__inbound__get_configuration",
  description: "Get detailed configuration by ID",
  parameters: {
    id: string
  },
  returns: {
    id: string,
    name: string,
    version: number,
    status: string,
    thresholds: {...},
    emailTemplate: {...},
    prompts: {...},
    autoSendPercentage: number,
    validation: {
      isComplete: boolean,
      missingFields: string[]
    }
  }
}
```

#### 2. Follow Existing MCP Patterns
Reference existing implementations:
- `mcp__inbound__list_leads`
- `mcp__inbound__get_lead`
- Similar structure for error handling, authentication, etc.

#### 3. Add Validation Info to MCP Response
Include validation status in responses:
- `isComplete: boolean`
- `missingFields: string[]` - array of missing required fields
- `emailTemplateConfigured: boolean`

This helps with debugging and understanding why leads might be getting "sort" status.

---

## Implementation Order

**Recommended sequence:**
1. Phase 2 (Foundation: complete configs by default)
2. Phase 3 (Feature: gradual rollout control)
3. Phase 4 (Tooling: MCP debugging)

**Alternative if debugging needed sooner:**
1. Phase 2
2. Phase 4
3. Phase 3

---

## Notes

### Current Status
- Phase 1 (UI improvements) is being implemented first
- Configuration list page updated to table layout
- "Active" → "Current" terminology change
- Vercel-style blue "Current" badge added

### Future Considerations
- Multi-user support: account settings per user/team
- Configuration templates: save/reuse email templates
- A/B testing: compare performance of different configs
- Analytics: track auto-send success rates

# Human Classification Workflow Implementation Plan

## Overview

Replace configuration-based A/B testing with percentage-based sampling. Add "Classify" workflow for uncertain leads and random sampling. Fix FakeCorp classification issue. Add low-value email template with no AI generation.

**Key Goals:**
1. Allow control over % of leads that get human classification (0-100%)
2. Unified "Classify" workflow for both uncertain AI classifications and randomly sampled leads
3. Post-classification auto-actions (forwards auto-send, low-value auto-sends template)
4. Store AI classifications even when routed to human (for comparison metrics)
5. Fix vague+unverifiable classification (FakeCorp should be uncertain → Classify)
6. Add spam test case

**Implementation Approach:**
- Email sending and forwarding are **mocked** (database status updates only)
- User authentication uses **middleware with hardcoded values**
- Production email integration and real auth can be added later
- Focus is on classification workflow and A/B testing logic

---

## Prerequisites Assessment

### ✅ EXISTS - Can Use Directly

1. **Email Generation Functions** (`lib/workflow-services.ts`)
   - `generateEmailForLead()`, `generateGenericEmail()`, `generateLowValueEmail()`
   - ✅ Ready to use

2. **Analytics/Event Tracking** (`lib/analytics-helpers.ts`)
   - `logAnalyticsEvent()` - Generic event logging
   - Need to add new event type: `human_ai_comparison`

3. **User Context** (`lib/user-context.tsx`)
   - Hardcoded: `userName: 'Ryan'`, `userEmail: 'ryan@example.com'`

4. **Configuration Helpers**
   - `getActiveConfiguration()` exists and works

5. **Database Operations**
   - Firestore `adminDb.collection("leads")` working

### ⚠️ PARTIAL - Needs Enhancement

6. **"Forward" Actions** (`app/api/leads/[id]/review/route.ts`)
   - Exists: Changes outcome to `forwarded_support` / `forwarded_account_team`
   - Missing: Actual forwarding integration (email/Slack)
   - **Decision**: Keep as mock (just update status) for now

### ❌ MISSING - Must Create

7. **Email Sending Service**
   - No actual email sending exists
   - "Approve" action just marks as `sent_meeting_offer`
   - **Decision**: Keep as mock for now (production-ready can add later)

8. **Middleware for User Context**
   - Need to create `middleware.ts`

9. **Email Template Helpers**
   - Need `lib/email-helpers.ts` with `fillTemplate()` and `extractFirstName()`

10. **Classify API Route**
    - Need `app/api/leads/[id]/classify/route.ts`

11. **Type Updates**
    - Need to add `needs_classification` outcome
    - Need to add AI tracking fields
    - Need to add `humanClassificationRate` to Configuration

---

## Phase 0: Prerequisites (NEW)

### 0.1 Create Middleware for User Context

**File:** `nextjs-app/middleware.ts` (NEW FILE)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Hardcode user for now - in production this would come from auth
  response.headers.set('x-user-email', 'ryan@example.com');
  response.headers.set('x-user-name', 'Ryan');

  return response;
}

// Apply to API routes that need user context
export const config = {
  matcher: '/api/leads/:path*',
};
```

**Usage in API routes:**
```typescript
const userEmail = request.headers.get('x-user-email') || 'ryan@example.com';
const userName = request.headers.get('x-user-name') || 'Ryan';
```

---

### 0.2 Create Email Template Helpers

**File:** `lib/email-helpers.ts` (NEW FILE)

```typescript
/**
 * Fill template with variables
 * Supported variables: {firstName}, {company}, {sdrName}
 */
export function fillTemplate(
  template: string,
  vars: {
    firstName: string;
    company: string;
    sdrName: string;
  }
): string {
  return template
    .replace(/{firstName}/g, vars.firstName)
    .replace(/{company}/g, vars.company)
    .replace(/{sdrName}/g, vars.sdrName);
}

/**
 * Extract first name from full name
 */
export function extractFirstName(fullName: string): string {
  return fullName.split(' ')[0];
}
```

---

### 0.3 Add Default Low-Value Template

**File:** `lib/email-templates.ts` (NEW FILE)

```typescript
export const DEFAULT_LOW_VALUE_TEMPLATE = `Hi {firstName},

Thanks for your interest in Vercel!

While we focus on helping teams with specific deployment and infrastructure needs, here are some resources that might be helpful:

• Documentation: https://vercel.com/docs
• Community: https://vercel.com/community
• Starter Templates: https://vercel.com/templates

Feel free to explore and reach out if you have specific questions about your deployment needs.

Best,
{sdrName}`;
```

---

## Phase 1: Data Model Changes

### 1.1 Update `LeadOutcome` Type

**File:** `lib/types.ts`

Add new outcome to represent leads needing human classification:

```typescript
export type LeadOutcome =
  | 'pending'
  | 'sent_meeting_offer'
  | 'sent_generic'
  | 'dead'
  | 'forwarded_account_team'
  | 'forwarded_support'
  | 'needs_classification'  // NEW
  | 'error'
  | null;
```

**Meaning:** Lead requires human to manually select classification in UI.

**Sources:**
- AI classified as `uncertain`
- Randomly sampled for human classification (based on `humanClassificationRate`)

---

### 1.1b Update `OUTCOMES` Configuration

**File:** `lib/outcomes.ts`

Add configuration for the new outcome:

```typescript
needs_classification: {
  key: 'needs_classification',
  label: 'Classify',
  description: 'Lead needs human classification',
  colors: {
    text: '#3b82f6',        // blue-500
    background: 'rgba(59, 130, 246, 0.1)',
    border: 'rgba(59, 130, 246, 0.2)',
  },
  icon: AlertCircle,
  category: 'pending',
  isTerminal: false,
},
```

---

### 1.2 Add Fields to `Lead` Interface

**File:** `lib/types.ts`

Add fields to track AI classification even when routed to human:

```typescript
export interface Lead {
  // ... existing fields ...

  // AI Classification (stored even when routed to human for comparison)
  ai_classification?: LeadClassification;
  ai_confidence?: number;
  ai_reasoning?: string;

  // Human classification tracking
  human_classified_at?: Timestamp | Date;
  sampled_for_human?: boolean;  // Was this randomly sampled (vs uncertain)?
}
```

**Purpose:**
- Compare human vs AI classifications
- Calculate agreement metrics
- Understand when AI is uncertain vs when we force human review

---

### 1.3 Update `AnalyticsEventType`

**File:** `lib/types.ts`

Add new event type for human vs AI comparison:

```typescript
export type AnalyticsEventType =
  | 'classified'
  | 'email_generated'
  | 'email_edited'
  | 'email_approved'
  | 'email_rejected'
  | 'reclassified'
  | 'meeting_booked'
  | 'lead_forwarded'
  | 'human_ai_comparison';  // NEW
```

---

### 1.4 Update `Configuration` Type

**File:** `lib/types.ts`

Add human classification rate and low-value email template:

```typescript
export interface Configuration {
  // ... existing fields ...

  settings: {
    // ... existing thresholds ...
    humanClassificationRate: number;  // NEW: 0-100, percentage of leads routed to human
  };

  emailTemplate: {
    // ... existing fields ...
    lowValueTemplate?: string;  // NEW: Static template for low-value emails
  };
}
```

**Example low-value template:**
```
Hi {firstName},

Thanks for your interest in Vercel!

While we focus on helping teams with specific deployment and infrastructure needs, here are some resources that might be helpful:

• Documentation: https://vercel.com/docs
• Community: https://vercel.com/community
• Starter templates: https://vercel.com/templates

Best,
{sdrName}
```

---

## Phase 2: Classification Improvements

### 2.1 Update Classification Prompt

**File:** `lib/prompts.ts` (lines 24-28)

**Current Issue:**
The prompt allows `uncertain` for any "legitimate-looking" message, even if vague. This causes FakeCorp ("Maybe interested") to classify as uncertain when it should be recognized as low-effort.

**Updated Guidance:**

```markdown
## COMPANY VERIFICATION RULES

1. **CRITICAL RULE**: If research returns "No results found", "Search failed",
   or shows no evidence the company exists online → ALWAYS classify as
   "uncertain" with confidence 0.50-0.65 (requires human verification).

2. Unverified companies can NEVER be classified as "quality" or "low-value".
   Human verification is required to determine if it's a legitimate lead or spam.

3. Only classify as "quality" if the research confirms the company exists
   with a legitimate web presence (website, LinkedIn, news articles, etc.).

## PERSON VERIFICATION RULES

1. **CRITICAL RULE**: If multiple people with the same name are found at the
   company, or LinkedIn shows ambiguous results → ALWAYS classify as
   "uncertain" with confidence 0.50-0.65 (requires human verification).

2. Unverified individuals can NEVER be classified as "quality" or "low-value".
   Human verification is required to confirm the correct person.

3. Job title "Not found" or "AMBIGUOUS IDENTITY" means verification failed
   and requires human review (classify as "uncertain").

## SPAM DETECTION

1. Obvious spam indicators:
   - Generic/fake company names (e.g., "Make Money Fast Ltd", "Get Rich Quick")
   - Suspicious email domains
   - ALL CAPS messages, excessive punctuation (!!!)
   - "Click here", "earn money", "limited time offer"
   - No real business context

2. For obvious spam, classify as "irrelevant" with confidence 0.85-0.95.
```

**Key Changes:**
- Explicit guidance on "vague intent" vs "clear business need"
- List examples of vague phrases
- Add person verification rules for ambiguous identity
- Add spam detection guidance

---

### 2.2 Add Spam Test Case

**File:** `lib/test-data.ts`

Add test case to ensure spam is caught:

```typescript
{
  label: 'Obvious Spam',
  expectedClassification: ['irrelevant'] as const,
  data: {
    name: 'Get Rich Quick',
    email: 'spam@example.com',
    company: 'Make Money Fast Ltd',
    message: 'Click here to earn $10,000 per day!!! Limited time offer!!!',
  },
  metadata: {
    isTestLead: true,
    testCase: 'spam',
    expectedClassifications: ['irrelevant'] as const,
  },
},
```

---

## Phase 3: Workflow Changes

### 3.1 Add Sampling Logic

**File:** `workflows/inbound/steps.ts` (after classification step, before autonomy determination)

Add logic to randomly sample leads for human classification:

```typescript
// After AI classification completes
const classificationResult = await classifyLead(leadId);

// Get active configuration
const config = await getActiveConfiguration();

// Determine if this lead should be routed to human classification
const shouldSampleForHuman = Math.random() * 100 < config.settings.humanClassificationRate;

if (shouldSampleForHuman) {
  console.log(`[Workflow] Lead ${leadId} randomly sampled for human classification (${config.settings.humanClassificationRate}% rate)`);

  // Store AI classification for later comparison
  await updateLead(leadId, {
    classification: classificationResult.classification,
    confidence_score: classificationResult.confidence,
    reasoning: classificationResult.reasoning,

    // Store AI results separately for comparison
    ai_classification: classificationResult.classification,
    ai_confidence: classificationResult.confidence,
    ai_reasoning: classificationResult.reasoning,

    sampled_for_human: true,
    outcome: 'needs_classification',
    autonomy: null, // Will be set when human classifies
    classified_at: new Date(),
  });

  // Stop workflow here - don't proceed to email generation or auto-actions
  return;
}

// Continue with normal workflow
// ... existing autonomy determination logic ...
```

**Key Points:**
- AI still runs classification (for comparison)
- Results stored in `ai_*` fields
- Outcome set to `needs_classification`
- Workflow stops (no email generation, no auto-actions)

---

### 3.2 Update Autonomy Determination

**File:** `workflows/inbound/steps.ts` (autonomy determination logic)

Handle `uncertain` classification:

```typescript
// Determine autonomy and outcome
if (classification === 'uncertain') {
  // Uncertain leads always need human classification
  outcome = 'needs_classification';
  autonomy = null; // Will be set after human classifies

  console.log(`[Workflow] Lead ${leadId} classified as uncertain - routing to Classify queue`);
}
else if (classification === 'quality') {
  // ... existing quality logic ...
}
// ... rest of existing logic ...
```

---

### 3.3 Skip Email Generation for `needs_classification`

**File:** `lib/workflow-services.ts` (email generation step)

Add check to skip email generation:

```typescript
export async function generateEmailStep(leadId: string) {
  const lead = await getLeadById(leadId);

  // Don't generate email if lead needs classification first
  if (lead.outcome === 'needs_classification') {
    console.log(`[Workflow] Skipping email generation - lead needs human classification`);
    return;
  }

  // ... existing email generation logic ...
}
```

---

## Phase 4: UI Changes

### 4.1 Create "Classify" Badge

**File:** `components/shared/LeadBadge.tsx`

Add badge for `needs_classification` outcome:

```typescript
if (lead.outcome === 'needs_classification') {
  return (
    <Badge className="bg-blue-600 hover:bg-blue-700 text-white">
      <AlertCircle className="h-3 w-3 mr-1" />
      Classify
    </Badge>
  );
}
```

**Styling:**
- Blue color (distinct from Review/Pending)
- AlertCircle icon
- Text: "Classify"

---

### 4.2 Build Classification UI

**File:** `app/dashboard/leads/[id]/page.tsx`

When `outcome === 'needs_classification'`, show classification interface:

**IMPORTANT A/B Testing Logic:**
- **Randomly sampled leads** (`sampled_for_human=true`): DON'T show AI classification (unbiased testing)
- **Uncertain leads** (`sampled_for_human=false`): SHOW AI classification and email (help human decide)

```typescript
{lead.outcome === 'needs_classification' && (
  <div className="space-y-4">
    {/* Show AI results ONLY if NOT randomly sampled (uncertain leads) */}
    {!lead.sampled_for_human && lead.ai_classification && (
      <div className="border border-blue-500/20 bg-blue-500/5 rounded-lg p-4 mb-4">
        <h4 className="font-semibold mb-2">AI Classification (Uncertain)</h4>
        <p className="text-sm">
          Classification: <strong>{lead.ai_classification}</strong> ({(lead.ai_confidence * 100).toFixed(0)}% confidence)
        </p>
        <p className="text-sm text-muted-foreground mt-1">{lead.ai_reasoning}</p>

        {/* Show generated email if it exists */}
        {lead.generated_email_body && (
          <div className="mt-3 p-3 bg-gray-50 rounded">
            <p className="text-xs font-medium mb-1">AI-Generated Email:</p>
            <pre className="text-xs whitespace-pre-wrap">{lead.generated_email_body}</pre>
          </div>
        )}
      </div>
    )}

    {/* For randomly sampled leads, show notice (don't show AI prediction) */}
    {lead.sampled_for_human && (
      <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-lg p-4 mb-4">
        <p className="text-sm">
          🧪 <strong>Quality Testing Sample</strong>
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          This lead was randomly sampled for quality testing.
          Classify independently without seeing AI's prediction.
        </p>
      </div>
    )}

    <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-lg p-4">
      <h3 className="font-semibold mb-2">Classify This Lead</h3>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Select Classification</label>
        <select
          value={selectedClassification}
          onChange={(e) => setSelectedClassification(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="">-- Select --</option>
          <option value="quality">Quality (Meeting Offer)</option>
          <option value="support">Support (Forward to Support)</option>
          <option value="low-value">Low-Value (Auto-send Template)</option>
          <option value="duplicate">Duplicate (Forward to Account Team)</option>
          <option value="dead">Dead (No Action)</option>
          <option value="irrelevant">Irrelevant/Spam (No Action)</option>
        </select>
      </div>

      <button
        onClick={handleClassify}
        disabled={!selectedClassification}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        Classify & Execute
      </button>
    </div>

    {/* Show research report for context */}
    <ResearchReport report={lead.research_report} />
  </div>
)}
```

---

### 4.3 Post-Classification Actions API

**File:** `app/api/leads/[id]/classify/route.ts` (NEW FILE)

Create endpoint to handle human classification:

```typescript
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { classification } = await req.json();
  const leadId = params.id;

  // Get user from middleware headers
  const userEmail = req.headers.get('x-user-email') || 'ryan@example.com';

  // Get lead and configuration
  const lead = await getLeadById(leadId);
  const config = await getActiveConfiguration();

  // Update lead with human classification
  await updateLead(leadId, {
    classification: classification,
    human_classified_at: new Date(),
    autonomy: 'review', // Human made the decision
  });

  // Execute post-classification action based on classification
  switch (classification) {
    case 'quality':
      // Generate AI email (if not already generated)
      await generateEmailForLead(leadId);
      await updateLead(leadId, { outcome: 'pending' });
      return NextResponse.json({ action: 'email_generated', message: 'Email generated for approval' });

    case 'support':
      // Auto-forward to support
      await forwardToSupport(lead);
      await updateLead(leadId, {
        outcome: 'forwarded_support',
        autonomy: 'auto',
        closed_at: new Date(),
        closed_by: 'Lead Agent'
      });
      return NextResponse.json({ action: 'forwarded', message: 'Forwarded to support team' });

    case 'duplicate':
      // Auto-forward to account team
      await forwardToAccountTeam(lead);
      await updateLead(leadId, {
        outcome: 'forwarded_account_team',
        autonomy: 'auto',
        closed_at: new Date(),
        closed_by: 'Lead Agent'
      });
      return NextResponse.json({ action: 'forwarded', message: 'Forwarded to account team' });

    case 'low-value':
      // Auto-send templated email (no AI)
      const template = config.emailTemplate.lowValueTemplate || DEFAULT_LOW_VALUE_TEMPLATE;
      const firstName = extractFirstName(lead.name);
      const emailBody = fillTemplate(template, {
        firstName: firstName,
        company: lead.company,
        sdrName: config.emailTemplate.signOff || 'The Team'
      });

      // NOTE: Email sending is mocked for now (just update database)
      // In production, call actual email service here:
      // await sendEmail({ to: lead.email, subject: '...', body: emailBody });

      await updateLead(leadId, {
        final_email_subject: 'Thanks for reaching out',
        final_email_body: emailBody,
        outcome: 'sent_generic',
        autonomy: 'auto',
        closed_at: new Date(),
        closed_by: 'Lead Agent'
      });

      return NextResponse.json({ action: 'sent', message: 'Low-value template email sent' });

    case 'dead':
    case 'irrelevant':
      // Mark as dead
      await updateLead(leadId, {
        outcome: 'dead',
        closed_at: new Date(),
        closed_by: userEmail
      });
      return NextResponse.json({ action: 'marked_dead', message: 'Lead marked as dead' });

    default:
      return NextResponse.json({ error: 'Invalid classification' }, { status: 400 });
  }
}
```

---

## Phase 5: Configuration UI Updates

### 5.1 Update Configuration Editor

**File:** `app/dashboard/configurations/new/page.tsx`

Add fields for new configuration options:

```tsx
{/* Human Classification Rate */}
<div>
  <label className="block text-sm font-medium mb-2">
    Human Classification Rate (%)
  </label>
  <p className="text-xs text-muted-foreground mb-2">
    Percentage of leads to route to human classification (0-100%).
    Used for testing AI accuracy.
  </p>
  <input
    type="number"
    min="0"
    max="100"
    value={humanClassificationRate}
    onChange={(e) => setHumanClassificationRate(Number(e.target.value))}
    className="w-full p-2 border rounded"
  />
</div>

{/* Low-Value Email Template */}
<div>
  <label className="block text-sm font-medium mb-2">
    Low-Value Email Template
  </label>
  <p className="text-xs text-muted-foreground mb-2">
    Static template for low-value leads. Available variables: {'{firstName}'}, {'{company}'}, {'{sdrName}'}
  </p>
  <textarea
    value={lowValueTemplate}
    onChange={(e) => setLowValueTemplate(e.target.value)}
    className="w-full p-2 border rounded font-mono text-sm"
    rows={10}
    placeholder={DEFAULT_LOW_VALUE_TEMPLATE}
  />
</div>
```

---

## Phase 6: Baseline Configuration

### 6.1 Update Baseline Settings

**File:** `app/api/admin/reinit-config/route.ts`

```typescript
const BASELINE_SETTINGS = {
  autoDeadLowValueThreshold: 0.9,
  autoDeadIrrelevantThreshold: 0.95,
  autoForwardDuplicateThreshold: 0.9,
  autoForwardSupportThreshold: 0.9,
  autoSendQualityThreshold: 0.95,
  qualityLeadConfidenceThreshold: 0.7,
  humanClassificationRate: 0,  // NEW: Start with 0% human (full AI)
};

const BASELINE_EMAIL_TEMPLATE = {
  subject: "Hi from Vercel",
  greeting: "Hi {firstName},",
  signOff: "Best,",
  callToAction: "Let's schedule a quick 15-minute call to discuss how Vercel can help.",
  lowValueTemplate: DEFAULT_LOW_VALUE_TEMPLATE,  // NEW
};
```

---

## Phase 7: Analytics & Comparison

### 7.1 Track Human vs AI Agreement

**File:** `app/api/leads/[id]/classify/route.ts` (add to POST handler)

After human classifies:

```typescript
// Helper function for confidence bucketing
function getConfidenceBucket(confidence: number): string {
  if (confidence < 0.5) return '0-50%';
  if (confidence < 0.7) return '50-70%';
  if (confidence < 0.9) return '70-90%';
  return '90-100%';
}

// Record analytics event for comparison
if (lead.sampled_for_human && lead.ai_classification) {
  const agreement = lead.ai_classification === classification;

  await logAnalyticsEvent(
    leadId,
    lead.configuration_id,
    'human_ai_comparison',
    {
      ai_classification: lead.ai_classification,
      ai_confidence: lead.ai_confidence,
      human_classification: classification,
      agreement: agreement,
      confidence_bucket: getConfidenceBucket(lead.ai_confidence),
    }
  );
}
```

---

### 7.2 Dashboard Metrics

**File:** `components/dashboard/Analytics.tsx`

Add new metrics section:

```typescript
// AI vs Human Comparison (only for sampled leads)
const sampledLeads = leads.filter(l => l.sampled_for_human);
const agreementCount = sampledLeads.filter(l =>
  l.ai_classification === l.classification
).length;
const agreementRate = (agreementCount / sampledLeads.length) * 100;

// Confidence vs Agreement Correlation
const highConfidenceAgreement = sampledLeads.filter(l =>
  l.ai_confidence >= 0.8 && l.ai_classification === l.classification
).length;
```

Display:
- Agreement rate (% where human agrees with AI)
- Agreement by confidence bucket (0-0.5, 0.5-0.7, 0.7-0.9, 0.9+)
- Confusion matrix (AI vs Human classifications)

---

## Phase 8: Testing Plan

### 8.1 Test Cases

**Spam Test:**
- Submit spam test case
- Verify classifies as `irrelevant` with high confidence
- Should auto-dead (if confidence ≥ 0.95)

**FakeCorp Test (Vague + Unverifiable):**
- Currently: `uncertain` (65%) ❌
- Expected: `uncertain` (60-65%) → `needs_classification` ✅
- After human classifies as low-value → auto-sends template

**Jennifer Martinez Test (Ambiguous Identity):**
- Currently: `uncertain` ❌
- Expected: `uncertain` → `needs_classification` ✅
- Research should show "AMBIGUOUS IDENTITY - Multiple Jennifer Martinez found at Shopify"

**Sampling Test:**
1. Set `humanClassificationRate` to 50%
2. Submit 100 test leads
3. Verify ~50 go to `needs_classification` (random sampling)
4. Verify AI classification stored in `ai_*` fields for sampled leads

**Post-Classification Actions Test:**
1. **Quality:** Classify as quality → email generated → awaiting approval
2. **Support:** Classify as support → auto-forwarded → closed
3. **Low-Value:** Classify as low-value → template sent → closed
4. **Duplicate:** Classify as duplicate → forwarded to account team → closed
5. **Dead:** Classify as dead → marked dead → closed

---

## Files to Modify

### Phase 0: Prerequisites
- ✅ `middleware.ts` - NEW: User context headers
- ✅ `lib/email-helpers.ts` - NEW: Template substitution functions
- ✅ `lib/email-templates.ts` - NEW: Default low-value template

### Phase 1: Data Model
- ✅ `lib/types.ts` - Lead, Configuration, LeadOutcome
- ✅ `lib/outcomes.ts` - Add needs_classification outcome config

### Phase 2: Prompts & Tests
- ✅ `lib/prompts.ts` - Classification prompt improvements
- ✅ `lib/test-data.ts` - Add spam test case

### Phase 3: Workflow
- ✅ `workflows/inbound/steps.ts` - Sampling logic, autonomy determination
- ✅ `lib/workflow-services.ts` - Skip email gen for needs_classification

### Phase 4: UI Components & API
- ✅ `components/shared/LeadBadge.tsx` - Classify badge
- ✅ `app/dashboard/leads/[id]/page.tsx` - Classification UI with A/B testing logic
- ✅ `app/api/leads/[id]/classify/route.ts` - NEW: Post-classification actions

### Phase 5: Configuration
- ✅ `app/dashboard/configurations/new/page.tsx` - Config editor
- ✅ `app/api/admin/reinit-config/route.ts` - Baseline config update

### Phase 6: Analytics (Future)
- ✅ `lib/analytics-helpers.ts` - Add human_ai_comparison event type
- ✅ `components/dashboard/Analytics.tsx` - Comparison metrics

---

## Migration Considerations

### Existing Leads
- Leads with `classification: 'uncertain'` and no outcome can be migrated to `outcome: 'needs_classification'`

### Existing Configurations
- Add default `humanClassificationRate: 0` to existing configs
- Add default `lowValueTemplate` to existing configs

### Backwards Compatibility
- All changes are additive (new fields, new outcome)
- Existing workflows continue to function
- New sampling logic only activates if `humanClassificationRate > 0`

---

## Rollout Strategy

1. **Phase 1 (No User Impact):** Deploy data model changes, update prompts
2. **Phase 2 (Internal Testing):** Set `humanClassificationRate: 100%` for testing
3. **Phase 3 (Gradual Rollout):** Start at 10% sampling, monitor agreement
4. **Phase 4 (Production):** Reduce to 5% for ongoing quality monitoring

---

## Success Metrics

- FakeCorp test passes (classifies as uncertain → needs_classification)
- Spam test passes (classifies as irrelevant with 90%+ confidence)
- Jennifer Martinez test passes (classifies as uncertain due to ambiguous identity)
- Sampling works correctly (X% of leads route to human)
- Human vs AI agreement rate measured
- Low-value emails auto-send with template (no AI generation)
- Post-classification actions execute correctly

---

## Resolved Decisions

1. ✅ **Show AI's classification to human?**
   - **YES for uncertain leads** (AI was uncertain, help human decide)
   - **NO for randomly sampled leads** (unbiased A/B testing)

2. ✅ **Unverified company/individual handling?**
   - Always route to `uncertain` (requires human verification)
   - Can never be classified as quality or low-value by AI

3. ✅ **User email handling?**
   - Use middleware to hardcode user email/name in headers
   - API routes read from `x-user-email` and `x-user-name` headers

4. ✅ **Email sending implementation?**
   - Keep as mock for now (just update database status)
   - Production-ready email integration can be added later

5. ✅ **Low-value template editable per-lead?**
   - No, static template only (configurable at configuration level)

## Open Questions

1. What should be the minimum `humanClassificationRate` for production? (Recommend: 5-10% for ongoing quality)
2. How to handle leads where human disagrees with high-confidence AI? (Flag for review? Retrain?)
3. Should we add a "Help needed" function for confidence bucket analysis?

# Lead Data Model: Autonomy + Classification + Outcome

**Last Updated:** 2025-01-20

---

## The Three Fields

### 1. `autonomy` - WHO Made the Decision

**Type:** `'review' | 'auto' | null`

- `null` → Not yet determined (still processing)
- `'review'` → Human review was/is required (stays forever)
- `'auto'` → System made automatic decision based on confidence thresholds

**Key Point:** Once set to `'review'` or `'auto'`, this value **never changes**. It preserves the historical record of whether a human was involved.

---

### 2. `classification` - WHAT the AI Thinks

**Type:** `'quality' | 'support' | 'duplicate' | 'low-value' | 'irrelevant' | 'dead' | 'uncertain' | null`

- `'quality'` → High-value lead worth personalized outreach
- `'support'` → Existing customer needing support
- `'duplicate'` → Duplicate submission from existing customer
- `'low-value'` → Real opportunity but not a good fit (small company, limited budget, etc.)
- `'irrelevant'` → Spam, test submission, or otherwise irrelevant (not a real lead)
- `'dead'` → Clearly not a lead (test, competitor, etc.)
- `'uncertain'` → AI is not confident, needs human assessment
- `null` → Not yet classified

**Key Point:** Set by AI once during workflow. Can be changed via "reclassify" action (re-runs entire workflow).

---

### 3. `outcome` - WHAT Happened (Final Result)

**Type:** `'pending' | 'sent_meeting_offer' | 'sent_generic' | 'dead' | 'forwarded_account_team' | 'forwarded_support' | 'error' | null`

- `null` → Processing (workflow running)
- `'pending'` → Awaiting human decision
- `'sent_meeting_offer'` → Meeting offer email approved and sent (quality leads)
- `'sent_generic'` → Generic message approved and sent (low-value/uncertain/support leads)
- `'dead'` → Lead closed without sending
- `'forwarded_account_team'` → Forwarded to account team (for duplicates and high-value leads)
- `'forwarded_support'` → Forwarded to support team (for support requests)
- `'error'` → Workflow failed (terminal state)

**Key Point:** Once set to a terminal value (`sent_meeting_offer`, `sent_generic`, `dead`, `forwarded_account_team`, `forwarded_support`, `error`), this value **never changes**.

---

## How They Work Together

```
Lead Submitted
    ↓
[Processing: autonomy=null, classification=null, outcome=null]
    ↓
AI Classifies + Confidence Check
    ↓
    ├─→ High Confidence → autonomy='auto', outcome=[terminal state]
    └─→ Low Confidence  → autonomy='review', outcome='pending'
         ↓
    Human Acts
         ↓
    autonomy='review' (unchanged), outcome=[terminal state]
```

---

## Configuration Thresholds

Each classification type has a configurable confidence threshold for auto-actions:

- `autoDeadLowValueThreshold` (e.g., 0.80) → Auto-dead low-value leads above this confidence (real opportunities, not a fit)
- `autoDeadIrrelevantThreshold` (e.g., 0.95) → Auto-dead irrelevant leads above this confidence (spam/nonsense)
- `autoForwardDuplicateThreshold` (e.g., 0.90) → Auto-forward duplicates to account team above this confidence
- `autoForwardSupportThreshold` (e.g., 0.85) → Auto-forward support requests above this confidence
- `autoSendQualityThreshold` (e.g., 0.95) → Auto-send quality emails above this confidence (future)

## Email Template Configuration

- `emailTemplate.lowValueCallToAction` → Configurable call-to-action for low-value sales emails (defaults to customers page link)

---

## Examples

### Example 1: High-Confidence Duplicate (Auto-Forwarded)

**Scenario:** AI classifies as duplicate with 95% confidence, threshold is 90%

```
Step 1: Lead submitted
  autonomy: null
  classification: null
  outcome: null
  → UI shows: "Processing"

Step 2: AI classifies
  classification: 'duplicate'
  confidence: 0.95
  threshold: 0.90
  Decision: 95% >= 90% → Auto-forward to account team

Step 3: Workflow completes
  autonomy: 'auto'           ← System decided (no human needed)
  classification: 'duplicate'
  outcome: 'forwarded_account_team' ← Terminal state
  → UI shows: "Forwarded to Account Team"
```

**Key Insight:** Never touched by a human. Fully automated.

---

### Example 2: Low-Confidence Duplicate (Human Review Required)

**Scenario:** AI classifies as duplicate with 75% confidence, threshold is 90%

```
Step 1: Lead submitted
  autonomy: null
  classification: null
  outcome: null
  → UI shows: "Processing"

Step 2: AI classifies
  classification: 'duplicate'
  confidence: 0.75
  threshold: 0.90
  Decision: 75% < 90% → Needs review

Step 3: Workflow completes
  autonomy: 'review'         ← Human review required
  classification: 'duplicate'
  outcome: 'pending'         ← Awaiting decision
  → UI shows: "Confirm Duplicate"

Step 4: Human confirms and forwards
  autonomy: 'review'         ← Stays 'review' forever
  classification: 'duplicate'
  outcome: 'forwarded_account_team' ← Terminal state
  → UI shows: "Forwarded to Account Team"
```

**Key Insight:** Human was involved. `autonomy='review'` preserves this record forever.

---

### Example 3: Quality Lead (Happy Path)

**Scenario:** AI classifies as quality with 92% confidence, threshold is 95%

```
Step 1: Lead submitted
  autonomy: null
  classification: null
  outcome: null
  → UI shows: "Processing" (blue)

Step 2: AI classifies & generates email
  classification: 'quality'
  confidence: 0.92
  threshold: 0.95
  Decision: 92% < 95% → Needs review

Step 3: Workflow completes
  autonomy: 'review'
  classification: 'quality'
  outcome: 'pending'
  → UI shows: "Reply with Meeting" (green)

Step 4: Human approves, email sent
  autonomy: 'review'         ← Stays 'review'
  classification: 'quality'
  outcome: 'sent_meeting_offer' ← Terminal state
  → UI shows: "Meeting Offer Sent" (green)
```

**Key Insight:** Quality leads always require human review (for now). Human approved the AI's assessment.

---

### Example 4: Quality Lead Rejected by Human

**Scenario:** AI thinks it's quality, but human disagrees

```
Steps 1-3: Same as Example 3
  autonomy: 'review'
  classification: 'quality'
  outcome: 'pending'
  → UI shows: "Review"

Step 4: Human rejects
  autonomy: 'review'         ← Stays 'review'
  classification: 'quality'  ← AI still thought it was quality!
  outcome: 'dead'            ← Human said no
  → UI shows: "Dead"
```

**Key Insight:** Classification stays `'quality'` even though human disagreed. This is valuable data for measuring AI accuracy.

---

### Example 5: Low-Value Lead (Real Opportunity, Not a Fit)

**Scenario:** AI classifies as low-value with 75% confidence, threshold is 80%

```
Step 1: Lead submitted
  autonomy: null
  classification: null
  outcome: null
  → UI shows: "Processing" (blue)

Step 2: AI classifies & generates sales email
  classification: 'low-value'
  confidence: 0.75
  threshold: 0.80
  Decision: 75% < 80% → Needs review

Step 3: Workflow completes
  autonomy: 'review'         ← Human review required
  classification: 'low-value'
  outcome: 'pending'         ← Awaiting decision
  email: Sales email with configurable CTA (no meeting offer)
  → UI shows: "Reply with Generic" (yellow)

Step 4: Human approves, email sent
  autonomy: 'review'         ← Stays 'review'
  classification: 'low-value'
  outcome: 'sent_generic'    ← Terminal state
  → UI shows: "Generic Message Sent" (gray)
```

**Key Insight:** Real opportunity but not a fit. Gets polite sales email from Vercel Team directing to self-service resources with configurable call-to-action (defaults to customers page).

---

### Example 6: Auto-Dead Irrelevant Lead (Spam/Nonsense)

**Scenario:** AI classifies as irrelevant with 97% confidence, threshold is 95%

```
Step 1: Lead submitted
  autonomy: null
  classification: null
  outcome: null
  → UI shows: "Processing"

Step 2: AI classifies (no email generated for irrelevant)
  classification: 'irrelevant'
  confidence: 0.97
  threshold: 0.95
  Decision: 97% >= 95% → Auto-dead (no email)

Step 3: Workflow completes
  autonomy: 'auto'           ← System decided
  classification: 'irrelevant'
  outcome: 'dead'            ← Terminal state
  email: null (no email for spam)
  → UI shows: "Dead"
```

**Key Insight:** Spam/test submission. Auto-dead without sending any email. Saves time on nonsense.

---

### Example 7: Workflow Error

**Scenario:** AI workflow crashes due to API timeout

```
Step 1: Lead submitted
  autonomy: null
  classification: null
  outcome: null
  → UI shows: "Processing"

Step 2: Workflow fails
  autonomy: null             ← Never got to decision point
  classification: null       ← Never got classified
  outcome: 'error'           ← Terminal error state
  error_message: "API timeout..."
  → UI shows: "Error"
```

**Key Insight:** Error is a terminal outcome. Requires manual intervention (reclassify action).

---

## UI Display Logic

The `LeadBadge` component uses this logic:

```typescript
if (outcome === null)
  → Show "Processing" (blue)

if (outcome === 'error')
  → Show "Error" (red)

if (outcome === 'sent_meeting_offer')
  → Show "Meeting Offer Sent" (green)

if (outcome === 'sent_generic')
  → Show "Generic Message Sent" (gray)

if (outcome === 'dead')
  → Show "Dead" (gray)

if (outcome === 'forwarded_account_team')
  → Show "Forwarded to Account Team" (purple)

if (outcome === 'forwarded_support')
  → Show "Forwarded to Support" (blue)

if (outcome === 'pending') {
  if (classification === 'quality') → Show "Reply with Meeting" (green)
  if (classification === 'support') → Show "Confirm Support" (yellow)
  if (classification === 'duplicate') → Show "Confirm Duplicate" (yellow)
  if (classification === 'low-value') → Show "Reply with Generic" (yellow)
  if (classification === 'irrelevant') → Show "Confirm Dead" (yellow)
  if (classification === 'uncertain') → Show "Review" (yellow)
  if (classification === 'dead') → Show "Confirm Dead" (yellow)
}
```

**User-focused:** Shows "what should I do?" for pending, "what happened?" for completed.

**Color scheme:**
- **Green**: High-value actions and outcomes (Reply with Meeting, Meeting Offer Sent)
- **Yellow**: Pending actions requiring review (Reply with Generic, Confirm Support, Confirm Duplicate, Confirm Dead)
- **Gray**: Low-priority terminal outcomes (Generic Message Sent, Dead)
- **Purple**: Forwarded to Account Team
- **Blue**: Forwarded to Support
- **Red**: Error state

---

## Analytics Queries

This model enables powerful analytics:

### Autonomy Metrics
- **Automation Rate:** `COUNT(autonomy='auto') / COUNT(*)`
- **Human Touch Rate:** `COUNT(autonomy='review') / COUNT(*)`

### AI Accuracy
- **Quality Agreement:** `COUNT(classification='quality' AND outcome='sent_meeting_offer') / COUNT(classification='quality')`
- **False Positives:** `COUNT(classification='quality' AND outcome='dead')`

### Classification Performance
- **Auto-Forward Success:** `COUNT(classification='duplicate' AND autonomy='auto')`
- **Support Routing:** `COUNT(classification='support' AND outcome='forwarded_support')`

### Outcome Distribution
- **Meeting Offer Rate:** `COUNT(outcome='sent_meeting_offer') / COUNT(*)`
- **Generic Message Rate:** `COUNT(outcome='sent_generic') / COUNT(*)`
- **Dead Rate:** `COUNT(outcome='dead') / COUNT(*)`
- **Error Rate:** `COUNT(outcome='error') / COUNT(*)`

---

## Validation Checklist

Use this to verify your mental model:

- [ ] `autonomy` is set exactly once when workflow completes (never changes)
- [ ] `classification` is set by AI (only changes on reclassify)
- [ ] `outcome` starts as `null`, becomes `'pending'` or terminal value, never changes after terminal
- [ ] Terminal outcomes: `sent_meeting_offer`, `sent_generic`, `dead`, `forwarded_account_team`, `forwarded_support`, `error`
- [ ] High-confidence leads get `autonomy='auto'` + terminal outcome (skip pending)
- [ ] Low-confidence leads get `autonomy='review'` + `outcome='pending'`
- [ ] Human actions change only `outcome` (autonomy stays `'review'`)
- [ ] Each classification type has its own confidence threshold (low-value: 0.80, irrelevant: 0.95, etc.)
- [ ] UI shows outcome for terminal states, action for pending states
- [ ] Quality leads get `sent_meeting_offer` outcome; others get `sent_generic`
- [ ] Low-value (real but not a fit) gets sales email; irrelevant (spam) gets no email
- [ ] Color scheme: Green (high-value), Yellow (pending actions), Gray (low-priority), Purple (account team), Blue (support)

---

**Questions?** Check `/docs/data-model-refactor.md` for the full design document.

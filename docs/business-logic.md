# Business Logic

This document describes how the data model (see `data-model.md`) is used by the system.

## Lead Lifecycle

```
Submission → Bot Processing → Review/Auto-send → Done
```

1. **Submission**: Lead arrives via form with name, email, company, message
2. **Bot Processing**: AI researches and classifies the lead
3. **Review/Auto-send**: Based on confidence vs threshold, either auto-send or queue for human review
4. **Done**: Terminal state - email sent, forwarded, or marked dead

## Classification Logic

### Classification Types
- `high-quality` - Strong fit, gets personalized meeting offer email
- `low-quality` - Real opportunity but not a fit, gets generic sales email
- `support` - Existing customer needing help, forwarded to support
- `duplicate` - Already a customer in CRM, forwarded to account team
- `irrelevant` - Spam/test/nonsense, no email sent

### Bot Research Output
The bot returns the full `bot_research` object (see `data-model.md`):
```
{
  timestamp: datetime
  confidence: float 0-1
  classification: classification enum
  reasoning: string
}
```

### Determining needs_review
```
needs_review = confidence < applied_threshold
```

Where `applied_threshold` is the threshold from settings for the given classification type.

## Threshold Settings

Each classification type has a corresponding threshold setting:

| Classification | Setting | Default |
|---------------|---------|---------|
| high-quality | autoSendQualityThreshold | 0.95 |
| low-quality | autoDeadLowValueThreshold | 0.9 |
| support | autoForwardSupportThreshold | 0.9 |
| duplicate | autoForwardDuplicateThreshold | 0.9 |
| irrelevant | autoDeadIrrelevantThreshold | 0.85 |

## Status Transitions

```
           ┌─────────────────────────────────────────┐
           │                                         │
           ▼                                         │
       received                                      │
           │                                         │
           ▼                                         │
    bot processing                                   │
           │                                         │
           ├── confidence >= threshold ──► done      │
           │       (auto-send)                       │
           │                                         │
           └── confidence < threshold ──► review ────┘
                                            │
                                            ▼
                                     human action
                                            │
                                            ▼
                                          done
```

## Terminal State Derivation

The terminal state is NOT stored - it's derived from `status` + `classifications[0].classification`:

| status | classifications[0] | Terminal State | Action |
|--------|-------------------|----------------|--------|
| done | high-quality | sent_meeting_offer | Personalized meeting email sent |
| done | low-quality | sent_generic | Generic sales email sent |
| done | support | forwarded_support | Forwarded to support team |
| done | duplicate | forwarded_account_team | Forwarded to account team |
| done | irrelevant | dead | No email sent |

### Deriving Terminal State in Code
```javascript
function getTerminalState(lead) {
  if (lead.status.status !== 'done') return null;

  const classification = lead.classifications[0].classification;

  switch (classification) {
    case 'high-quality': return 'sent_meeting_offer';
    case 'low-quality': return 'sent_generic';
    case 'support': return 'forwarded_support';
    case 'duplicate': return 'forwarded_account_team';
    case 'irrelevant': return 'dead';
  }
}
```

## Human Actions

### Approve
- Keep current classification
- Set `status.status: done`
- Set `status.sent_at: now`

### Reclassify
1. Add new entry to front of `classifications` array:
   ```
   {
     author: "human"
     classification: [new classification]
     timestamp: now
   }
   ```
2. Proceed based on new classification:

| New Classification | Action | Status |
|-------------------|--------|--------|
| high-quality | Generate personalized email | review (human must approve) |
| low-quality | Send static generic email | done (auto-sent) |
| support | Forward to support team | done |
| duplicate | Forward to account team | done |
| irrelevant | No email sent | done (terminal: dead) |

### Edit Email
1. Add new entry to front of `human_edits.versions` array:
   ```
   {
     text: [edited email]
     timestamp: now
   }
   ```
2. Optionally add `human_edits.note` explaining the edit
3. Approve sends the edited version

## Bot Rollout (A/B Testing)

Controls what percentage of auto-eligible leads actually auto-send:

```
bot_rollout: {
  useBot: boolean      // master toggle
  rollOut: float 0-1   // percentage chance of auto-send
}
```

### Auto-send Decision
```javascript
function shouldAutoSend(lead, botRollout) {
  if (!botRollout.useBot) return false;
  if (lead.classifications[0].needs_review) return false;

  return Math.random() < botRollout.rollOut;
}
```

When auto-send doesn't fire (random >= rollOut), lead goes to `status: review` for human approval despite meeting the confidence threshold.

## Analytics Derivation

All metrics are derived from stored data:

### Processing Time
```javascript
processingTime = bot_research.timestamp - status.received_at
```

### Time to Send
```javascript
timeToSend = status.sent_at - status.received_at
```

### Human Override Rate
```javascript
overrideRate = leads.filter(l => l.classifications.length > 1).length / leads.length
```
When `classifications.length > 1`, a human reclassified after the bot.

### Auto-send Rate
```javascript
autoSendRate = leads.filter(l =>
  l.classifications.length === 1 &&
  l.classifications[0].author === 'bot' &&
  l.status.status === 'done'
).length / leads.length
```

### Bot Accuracy (on sampled leads)
Compare bot classification to human classification on leads that went through review:
```javascript
const sampledLeads = leads.filter(l => l.classifications.length > 1);
const matches = sampledLeads.filter(l =>
  l.classifications[0].classification === l.classifications[1].classification
);
botAccuracy = matches.length / sampledLeads.length;
```

### Confidence Distribution by Classification
```javascript
const byClassification = groupBy(leads, l => l.bot_research.classification);
Object.entries(byClassification).map(([cls, leads]) => ({
  classification: cls,
  avgConfidence: average(leads.map(l => l.bot_research.confidence)),
  count: leads.length
}));
```

# Settings Configuration

This document describes the system configuration stored in Firestore.

## Configuration Structure

```
configuration {
  thresholds: {
    highQuality: float 0-1
    lowValue: float 0-1
    support: float 0-1
    duplicate: float 0-1
    irrelevant: float 0-1
  }

  sdr: {
    name: string
    email: string
  }

  emailTemplates: {
    subject: string
    greeting: string
    signOff: string
    lowValueCallToAction: string
  }

  prompts: {
    classification: string
    emailHighQuality: string
    emailLowValue: string
    emailGeneric: string
  }

  rollout: {
    enabled: boolean
    percentage: float 0-1
  }

  updated_at: datetime
  updated_by: string
}
```

## Thresholds

Confidence thresholds determine when the bot can auto-act vs require human review.

| Threshold | Default | Description |
|-----------|---------|-------------|
| highQuality | 0.95 | Auto-send meeting offer to high-quality leads |
| lowValue | 0.9 | Auto-send generic email to low-value leads |
| support | 0.9 | Auto-forward to support team |
| duplicate | 0.9 | Auto-forward to account team |
| irrelevant | 0.85 | Auto-mark as dead (no email) |

**Logic**: If `confidence >= threshold`, the lead can auto-act. Otherwise, `needs_review: true`.

## SDR

Sales Development Representative info for personalized emails to high-quality leads.

| Field | Example | Description |
|-------|---------|-------------|
| name | "Ryan" | SDR name used in email signature |
| email | "ryan@vercel.com" | SDR email for replies |

## Email Templates

Template components used when generating emails.

| Field | Example | Description |
|-------|---------|-------------|
| subject | "Hi from Vercel" | Default email subject line |
| greeting | "Hi {firstName}," | Email greeting with variable support |
| signOff | "Best," | Email sign-off |
| lowValueCallToAction | "Check out vercel.com/customers" | CTA for low-value lead emails |

### Template Variables
- `{firstName}` - Lead's first name
- `{company}` - Lead's company name
- `{sdrName}` - SDR name from settings

## Prompts

AI prompts for classification and email generation. Editable via settings UI.

| Prompt | Purpose |
|--------|---------|
| classification | Lead qualification rules - determines high-quality, low-value, support, duplicate, irrelevant |
| emailHighQuality | Generates personalized meeting offer email body for high-quality leads |
| emailLowValue | Generates generic sales email body for low-value leads |
| emailGeneric | Generates response for support/uncertain leads |

### Prompt Guidelines
- Classification prompt should return: classification, confidence (0-1), reasoning
- Email prompts should return only the body content (greeting/signoff added automatically)
- Do not include sign-offs or signatures in email prompts

## Rollout

Controls what percentage of auto-eligible leads actually auto-send.

| Field | Default | Description |
|-------|---------|-------------|
| enabled | false | Master toggle for bot auto-send |
| percentage | 0 | Percentage (0-1) of eligible leads to auto-send |

**Logic**: When a lead passes the confidence threshold AND `enabled: true`, there's a `percentage` chance it auto-sends. Otherwise, it goes to human review.

This allows gradual rollout of automation while monitoring quality.

## Metadata

| Field | Description |
|-------|-------------|
| updated_at | Timestamp of last configuration change |
| updated_by | User who made the last change |

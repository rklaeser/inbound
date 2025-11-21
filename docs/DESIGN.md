# Lead Agent System - Technical Design

## Architecture Overview

Next.js application with App Router implementing an automated lead qualification and response system.

### Tech Stack
- **Frontend**: Next.js 15.5 (App Router), React, TypeScript
- **Styling**: Tailwind CSS for visual polish
- **Database**: Firestore (flexible schema, real-time updates)
- **AI/LLM**: Vercel AI SDK for lead classification and email generation
- **Email**: Resend or SendGrid for email delivery
- **Auth**: NextAuth.js for admin access

## Application Structure

```
/app
  /page.tsx                    # Public lead submission form
  /api
    /leads
      /submit/route.ts         # Accept new leads
      /classify/route.ts       # Classify lead quality
      /generate-email/route.ts # Generate response email
    /analytics/route.ts        # Data collection endpoints
  /admin
    /page.tsx                  # Admin dashboard
    /prompts/page.tsx          # Prompt management interface
    /review/page.tsx           # Human verification queue
  /components
    /LeadForm.tsx              # Lead submission form
    /ReviewQueue.tsx           # Lead review interface
    /PromptEditor.tsx          # Prompt configuration
    /AnalyticsDashboard.tsx    # Metrics display
```

## Data Model (Firestore Collections)

### Leads Collection
```typescript
{
  id: string                    // Auto-generated document ID
  email: string
  name: string
  company: string
  message: string
  classification: 'quality' | 'support' | 'low-value' | 'uncertain'
  confidence_score: number
  status: 'pending' | 'auto_responded' | 'human_review' | 'sent' | 'rejected'
  generated_email: string | null
  final_email: string | null
  edited: boolean
  test_mode: boolean            // Whether email was sent in test mode
  email_id: string | null       // External email service ID (if actually sent)
  created_at: Timestamp
  responded_at: Timestamp | null
}
```

### Prompts Collection
```typescript
{
  id: string                    // Auto-generated document ID
  name: string
  type: 'classification' | 'email_generation' | 'routing'
  prompt_text: string
  version: number
  active: boolean
  created_at: Timestamp
}
```

### Analytics Collection
```typescript
{
  id: string                    // Auto-generated document ID
  lead_id: string               // Reference to lead document
  metric_type: 'classification' | 'email_edit' | 'time_to_lead'
  value: string
  recorded_at: Timestamp
}
```

**Firestore Indexes**:
- `leads`: Compound index on `status` + `created_at` for queue sorting
- `prompts`: Compound index on `type` + `active` for fetching active prompts
- `analytics`: Index on `lead_id` and `metric_type` for reporting

## Key Components

### 1. Lead Submission Form (`/`)
- **Purpose**: Public-facing form to capture lead information
- **Fields**: Name, Email, Company, Message/Inquiry
- **Flow**: Submit → API validation → Store in DB → Trigger classification workflow

### 2. Classification Workflow (`/api/leads/classify`)
```typescript
1. Receive lead data
2. Fetch active classification prompt from DB
3. Call LLM with prompt + lead data
4. Parse response: { classification, confidence_score, reasoning }
5. Update lead record
6. Route based on decision criteria:
   - High confidence quality → Generate email
   - Support/CRM → Forward to appropriate channel
   - Low confidence/uncertain → Human review queue
```

### 3. Email Generation (`/api/leads/generate-email`)
```typescript
1. Fetch active email generation prompt
2. Call LLM with prompt + lead context
3. Generate brief, professional response (not overly positive)
4. Store as generated_email
5. Route to human verification if needed
6. Otherwise mark as auto_responded
```

### 4. Human Review Queue (`/admin/review`)
- **Purpose**: Interface for reviewing uncertain leads and generated emails
- **Features**:
  - List view of pending reviews
  - Lead details and classification reasoning
  - Edit generated email before sending
  - Approve/reject/reclassify options
  - Track edits for analytics

- **UI**: Clean table with expandable rows, inline editing

### 5. Admin Panel (`/admin`)
- **Dashboard**: Overview of lead pipeline, conversion rates, time to lead metrics
- **Analytics**: Charts showing sorting accuracy, edit rates, response times
- **Email Mode Badge**: Prominent indicator showing current mode (TEST/PRODUCTION)
- **Access Control**: Protected by authentication

### 6. Prompt Management (`/admin/prompts`)
- **Features**:
  - List all prompts by type
  - Edit prompt text with rich text editor
  - Version control (save as new version)
  - Activate/deactivate versions
  - Test prompt with sample leads before deployment
  - Show prompt performance metrics

## API Routes

### POST `/api/leads/submit`
- Accept lead form submission
- Validate input
- Store in database
- Trigger async classification workflow
- Return success response

### POST `/api/leads/classify`
- Internal: Classify lead using LLM
- Update lead classification and confidence
- Route to next step based on criteria

### POST `/api/leads/generate-email`
- Internal: Generate email response
- Store generated content
- Mark for human review or auto-send

### GET/POST `/api/admin/prompts`
- CRUD operations for prompts
- Version management
- Activation/deactivation

### GET `/api/analytics/metrics`
- Fetch aggregated metrics
- Support filtering by date range
- Return sorting accuracy, edit rates, time to lead

### PATCH `/api/leads/:id/review`
- Human review actions
- Update email content
- Approve for sending
- Track edits

## Workflow Steps Implementation

### 1. Research
- Extract lead data from form submission
- Enrich with any available context (domain lookup, company info)
- Prepare context for classification

### 2. Filter
```typescript
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'

const classifyLead = async (lead) => {
  const prompt = await getActivePrompt('classification')

  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: z.object({
      classification: z.enum(['quality', 'support', 'low-value', 'uncertain']),
      confidence: z.number().min(0).max(1),
      reasoning: z.string()
    }),
    prompt: `${prompt}\n\nLead Data:\n${JSON.stringify(lead, null, 2)}`
  })

  // Decision criteria (bias towards human review)
  if (object.confidence < 0.7) {
    return { route: 'human_review', reason: 'Low confidence' }
  }
  if (object.classification === 'support') {
    return { route: 'forward_crm', reason: 'Support inquiry' }
  }
  if (object.classification === 'quality') {
    return { route: 'generate_email', reason: 'Quality lead' }
  }
  return { route: 'human_review', reason: 'Default to human' }
}
```

### 3. Create Email
```typescript
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'

const generateEmail = async (lead, classification) => {
  const prompt = await getActivePrompt('email_generation')

  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: z.object({
      subject: z.string(),
      body: z.string()
    }),
    prompt: `${prompt}\n\nLead Data:\n${JSON.stringify(lead, null, 2)}\n\nClassification:\n${JSON.stringify(classification, null, 2)}\n\nGenerate a brief, professional email response. Do not be overly positive.`
  })

  return {
    subject: object.subject,
    body: object.body,
    requires_review: classification.confidence < 0.85
  }
}
```

### 4. Human Verify
- Queue shows all leads requiring review
- Display classification reasoning for transparency
- Allow inline editing of generated emails
- Track whether email was edited (for analytics)
- One-click approve/send button
- **Email Mode Indicator**: Show whether system is in test mode (emails not sent) or production mode (emails actually sent)

### Email Sending Logic
```typescript
const sendEmail = async (lead, emailContent) => {
  const isTestMode = process.env.EMAIL_MODE !== 'production'

  if (isTestMode) {
    // Test mode: Log but don't actually send
    console.log('[TEST MODE] Would send email:', {
      to: lead.email,
      subject: emailContent.subject,
      body: emailContent.body
    })

    // Update lead status as if sent
    await db.collection('leads').doc(lead.id).update({
      status: 'sent',
      final_email: emailContent.body,
      responded_at: new Date(),
      test_mode: true
    })

    return { success: true, test_mode: true }
  }

  // Production mode: Actually send via email service
  const result = await emailService.send({
    to: lead.email,
    subject: emailContent.subject,
    body: emailContent.body
  })

  await db.collection('leads').doc(lead.id).update({
    status: 'sent',
    final_email: emailContent.body,
    responded_at: new Date(),
    test_mode: false,
    email_id: result.id
  })

  return { success: true, test_mode: false }
}
```

## Data Collection Implementation

### Sorting Accuracy
```typescript
// Track when humans reclassify leads
onReclassification(lead, originalClass, newClass) {
  recordAnalytic({
    lead_id: lead.id,
    metric_type: 'classification',
    value: JSON.stringify({
      original: originalClass,
      corrected: newClass,
      accurate: originalClass === newClass
    })
  })
}
```

### Email Edits
```typescript
// Track when humans edit generated emails
onEmailEdit(lead, originalEmail, editedEmail) {
  recordAnalytic({
    lead_id: lead.id,
    metric_type: 'email_edit',
    value: JSON.stringify({
      edited: originalEmail !== editedEmail,
      edit_distance: calculateEditDistance(originalEmail, editedEmail)
    })
  })
}
```

### Time to Lead
```typescript
// Calculate time from submission to response
onEmailSent(lead) {
  const timeToLead = lead.responded_at - lead.created_at
  recordAnalytic({
    lead_id: lead.id,
    metric_type: 'time_to_lead',
    value: timeToLead.toString()
  })
}
```

## UI/UX Considerations

### Visual Polish (G requirement)
- Clean, modern interface using Tailwind CSS
- Responsive design
- Loading states for all async operations
- Success/error notifications
- Smooth transitions

### Clear Logic (Priority)
- Display reasoning for all classifications
- Show confidence scores
- Transparent decision-making
- Audit trail for all actions

### SLC Principles
- **Simple**: Focus on core workflow, minimal features
- **Lovable**: Fast, reliable, solves real problem
- **Complete**: End-to-end functionality works

## Deployment

- **Platform**: Vercel
- **Database**: Firestore (Firebase project)
- **Environment Variables**:
  - `OPENAI_API_KEY` (for Vercel AI SDK)
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`
  - `EMAIL_API_KEY` (Resend or SendGrid)
  - `EMAIL_MODE` (default: `test`, set to `production` to actually send emails)
  - `NEXTAUTH_SECRET`

### Firestore Setup
```typescript
// lib/firestore.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  })
}

export const db = getFirestore()
```

## Future Enhancements (Post-SLC)
- Batch processing for multiple leads
- Email templates library
- A/B testing for email variations
- Integration with CRM systems
- Webhook notifications
- Mobile app for review queue

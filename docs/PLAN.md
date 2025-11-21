# Lead Agent System - Implementation Plan (SLC)

## Overview
Building an automated lead qualification and response system as a demo application. The system classifies incoming leads using AI, generates appropriate email responses, and routes uncertain cases to human review.

**Demo Format**: Single Next.js application with separate routes - customer-facing lead form (`/`) and internal SDR dashboard (`/dashboard`). Demo by opening both routes in separate browser tabs side-by-side to see the workflow in real-time via Firestore sync.

## Goals (SLC - Simple, Lovable, Complete)
- ✅ Core workflow: Lead submission → AI classification → Email generation → Review → "Sent"
- ✅ Two separate routes: `/` (customer) and `/dashboard` (SDR)
- ✅ Real-time updates via Firestore listeners
- ✅ Visual polish with Tailwind CSS
- ✅ Clear, transparent AI decision-making
- ❌ No authentication (demo mode)
- ❌ No actual email sending (emails go to "Sent" view instead)
- ❌ Minimal analytics (basic tracking, simple display)
- ❌ Hardcoded or simple prompt management (no complex versioning for SLC)

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Firestore (new Firebase project)
- **AI/LLM**: Vercel AI SDK with OpenAI (gpt-4o)
- **Markdown Rendering**: react-markdown (for displaying docs)
- **Deployment**: Vercel
- **No Auth**: Skip NextAuth for SLC demo

## Architecture

### Folder Structure
```
/app
  /page.tsx                          # Customer view - Lead submission form
  /dashboard
    /page.tsx                        # SDR dashboard - Review queue, sent, docs
  /layout.tsx                        # Root layout
  /globals.css                       # Tailwind imports
  /api
    /leads
      /submit/route.ts               # Create new lead
      /classify/route.ts             # AI classification
      /generate-email/route.ts       # AI email generation
      /[id]
        /route.ts                    # Get/update individual lead
        /review/route.ts             # Human review actions
  /components
    /customer
      /LeadForm.tsx                  # Lead submission form component
      /SuccessMessage.tsx            # Form success state
    /dashboard
      /ReviewQueue.tsx               # Leads pending review
      /SentEmails.tsx                # "Sent" emails display
      /AllLeads.tsx                  # Complete leads list
      /DocsViewer.tsx                # Documentation display
      /LeadCard.tsx                  # Individual lead display
      /EmailPreview.tsx              # Email preview/edit component
    /shared
      /StatusBadge.tsx               # Status indicator component
/lib
  /firestore.ts                      # Firestore client initialization
  /firestore-admin.ts                # Firestore admin SDK (server-side)
  /ai.ts                             # Vercel AI SDK utilities
  /types.ts                          # TypeScript types
  /prompts.ts                        # Prompt templates (hardcoded for SLC)
```

## Data Models (Firestore Collections)

### `leads` Collection
```typescript
interface Lead {
  id: string                    // Auto-generated document ID

  // Lead information
  name: string
  email: string
  company: string
  message: string

  // Classification
  classification: 'quality' | 'support' | 'low-value' | 'uncertain' | null
  confidence_score: number | null
  reasoning: string | null      // AI reasoning for classification

  // Email generation
  generated_email_subject: string | null
  generated_email_body: string | null
  final_email_subject: string | null    // After human edits
  final_email_body: string | null       // After human edits
  edited: boolean               // Whether human edited the email

  // Status tracking
  status: 'pending' | 'classified' | 'email_generated' | 'in_review' | 'sent'

  // Timestamps
  created_at: Timestamp
  classified_at: Timestamp | null
  sent_at: Timestamp | null
}
```

### `analytics` Collection (Optional for SLC)
```typescript
interface Analytic {
  id: string
  lead_id: string
  event_type: 'classification' | 'email_edit' | 'sent'
  data: any                     // Flexible data structure
  recorded_at: Timestamp
}
```

## Key Pages & Components

### 1. Customer Page (`/app/page.tsx`)
**Route**: `/`
**Purpose**: Public-facing lead submission form

Features:
- Clean, professional landing page design
- Lead submission form with fields:
  - Name (required)
  - Email (required, validated)
  - Company (required)
  - Message/Inquiry (required, textarea)
- Form validation
- Success message after submission
- Responsive design
- Minimal branding (represents customer-facing site)

### 2. SDR Dashboard (`/app/dashboard/page.tsx`)
**Route**: `/dashboard`
**Purpose**: Internal SDR tools and lead management

Features:
- Tabbed interface:
  - **Review Queue**: Leads needing human review
  - **Sent Emails**: All emails marked as "sent"
  - **All Leads**: Complete list with filters
  - **Docs**: Display REQUIREMENTS.md, DESIGN.md, and PLAN.md
- Real-time Firestore listeners for automatic updates
- Status indicators for each lead
- Internal tool styling (different from customer-facing)

### 3. Review Queue (`/components/dashboard/ReviewQueue.tsx`)
Display leads that need human attention:
- Show classification reasoning
- Display generated email (editable)
- Actions:
  - Edit email content
  - Approve & Send (marks as sent)
  - Reject (mark as rejected)
  - Reclassify (trigger re-classification)
- Track if email was edited

### 4. Sent Emails (`/components/dashboard/SentEmails.tsx`)
Display all emails marked as "sent":
- Show final email content
- Display recipient info
- Show timestamp
- Indicate if email was edited before sending
- Badge showing classification type

### 5. Docs Viewer (`/components/dashboard/DocsViewer.tsx`)
Display project documentation within the demo:
- Render REQUIREMENTS.md, DESIGN.md, and PLAN.md
- Use react-markdown for formatted display
- Tab or accordion navigation between docs
- Styled markdown with proper headings, code blocks, lists
- Makes the demo self-documenting

## API Routes

### POST `/api/leads/submit`
**Purpose**: Accept new lead from form submission

**Flow**:
1. Validate input data
2. Create lead document in Firestore with status: 'pending'
3. Trigger classification workflow (call classify endpoint)
4. Return success response with lead ID

**Request Body**:
```typescript
{
  name: string
  email: string
  company: string
  message: string
}
```

**Response**:
```typescript
{
  success: boolean
  leadId: string
}
```

### POST `/api/leads/classify`
**Purpose**: Classify lead using AI

**Flow**:
1. Fetch lead data from Firestore
2. Call Vercel AI SDK with classification prompt
3. Parse structured response:
   ```typescript
   {
     classification: 'quality' | 'support' | 'low-value' | 'uncertain'
     confidence: number (0-1)
     reasoning: string
   }
   ```
4. Update lead document with classification data
5. Route based on decision criteria:
   - `confidence >= 0.7 AND classification === 'quality'` → Generate email
   - `confidence < 0.7 OR classification === 'uncertain'` → Human review
   - `classification === 'support'` → Human review (for demo, in production would route to CRM)
   - `classification === 'low-value'` → Human review
6. Update status to 'classified'

**Request Body**:
```typescript
{
  leadId: string
}
```

### POST `/api/leads/generate-email`
**Purpose**: Generate email response using AI

**Flow**:
1. Fetch lead data from Firestore
2. Call Vercel AI SDK with email generation prompt
3. Parse structured response:
   ```typescript
   {
     subject: string
     body: string
   }
   ```
4. Store as generated_email_subject and generated_email_body
5. Route based on confidence:
   - `confidence >= 0.85` → Could auto-mark as sent (or still require review for demo)
   - `confidence < 0.85` → Human review
6. Update status to 'email_generated' or 'in_review'

**Request Body**:
```typescript
{
  leadId: string
}
```

### PATCH `/api/leads/{id}/review`
**Purpose**: Handle human review actions

**Actions**:
- **Edit email**: Update final_email_subject and final_email_body, set edited: true
- **Approve & Send**: Update status to 'sent', set sent_at timestamp
- **Reject**: Update status to 'rejected'
- **Reclassify**: Trigger re-classification

**Request Body**:
```typescript
{
  action: 'edit' | 'approve' | 'reject' | 'reclassify'
  email_subject?: string      // For edit action
  email_body?: string         // For edit action
}
```

## Implementation Workflow

### Complete Lead Journey Example

1. **Customer submits form** (left side)
   - POST to `/api/leads/submit`
   - Lead created with status: 'pending'

2. **AI Classification** (automatic)
   - POST to `/api/leads/classify`
   - Lead updated with classification, confidence, reasoning
   - Status: 'classified'

3. **Decision routing**:
   - **High confidence quality lead** → POST to `/api/leads/generate-email`
     - Email generated
     - Status: 'email_generated'
     - Appears in review queue (right side)

   - **Low confidence or uncertain** → Straight to review queue
     - Status: 'in_review'
     - No email generated yet
     - Human can trigger email generation or write manually

4. **Human review** (right side)
   - SDR sees lead in review queue
   - Can edit email if generated
   - Clicks "Approve & Send"
   - PATCH to `/api/leads/{id}/review` with action: 'approve'
   - Status: 'sent'
   - Moves to "Sent Emails" tab

5. **Sent emails view** (right side)
   - Display all leads with status: 'sent'
   - Show final email content
   - Show metadata (classification, edited, timestamp)

## AI Prompts (Hardcoded for SLC)

### Classification Prompt (`/lib/prompts.ts`)
```typescript
export const CLASSIFICATION_PROMPT = `You are a lead qualification expert. Analyze the following lead and classify it into one of these categories:

- quality: High-value potential customer with clear business need
- support: Existing customer or inquiry about product support/help
- low-value: Spam, irrelevant, or not a good fit
- uncertain: Ambiguous or needs more information

Provide a confidence score (0-1) and brief reasoning.

Be conservative - when in doubt, classify as 'uncertain' to route to human review.

Return structured data only.`
```

### Email Generation Prompt (`/lib/prompts.ts`)
```typescript
export const EMAIL_GENERATION_PROMPT = `You are a professional SDR writing a response to a qualified lead.

Generate a brief, professional email response. Guidelines:
- Keep it concise (2-3 short paragraphs)
- Be professional but not overly enthusiastic
- Address their specific inquiry
- Include a clear call-to-action
- Do not make promises or commitments
- Maintain a helpful, informative tone

Return structured data with subject and body.`
```

## UI/UX Design Principles

### Two-Page Architecture

**Customer Page** (`/`)
```
┌─────────────────────────────────────┐
│      Submit a Lead Inquiry          │
├─────────────────────────────────────┤
│                                     │
│  Name: _______________________      │
│  Email: ______________________      │
│  Company: ____________________      │
│  Message:                           │
│  ____________________________        │
│  ____________________________        │
│  ____________________________        │
│                                     │
│       [Submit Inquiry]              │
│                                     │
│  ✓ Success: We'll be in touch!     │
└─────────────────────────────────────┘
```

**SDR Dashboard** (`/dashboard`)
```
┌─────────────────────────────────────┐
│         SDR Dashboard               │
├─────────────────────────────────────┤
│ [Review] [Sent] [All Leads] [Docs] │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐  │
│  │ Lead Card                     │  │
│  │ • Classification: Quality     │  │
│  │ • Confidence: 85%             │  │
│  │ • Reasoning: ...              │  │
│  │ • Generated Email:            │  │
│  │   [Subject] [Body - editable] │  │
│  │   [Edit] [Approve & Send]     │  │
│  └───────────────────────────────┘  │
│                                     │
│  Real-time updates via Firestore    │
└─────────────────────────────────────┘
```

### Demo Experience
- Open both routes in separate browser tabs/windows
- Position side-by-side on screen
- Submit lead on customer page → instantly see it in dashboard
- Communication via Firestore real-time listeners

### Visual Design
- **Color scheme**:
  - Customer page: Clean, professional, public-facing design (light blue/white)
  - Dashboard page: Internal tool aesthetic (gray/white with data tables)

- **Status badges**:
  - Pending: Gray
  - Classified: Blue
  - In Review: Yellow
  - Sent: Green
  - Rejected: Red

- **Responsive design**:
  - Both pages fully responsive
  - Customer page: Mobile-first form design
  - Dashboard: Responsive tables and cards

### Loading States
- Form submission: Button spinner + disabled state
- Classification: "Analyzing lead..." indicator
- Email generation: "Generating email..." indicator
- Real-time updates: Smooth animations when new items appear

## Environment Variables

Create `.env.local`:
```bash
# OpenAI (via Vercel AI SDK)
OPENAI_API_KEY=sk-...

# Firebase (new project)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Firebase Admin SDK (server-side)
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

## Firebase Setup Steps

1. **Create new Firebase project**:
   - Go to Firebase Console
   - Create new project
   - Enable Firestore Database
   - Set up security rules (allow read/write for demo)

2. **Security Rules** (permissive for demo):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. **Indexes**:
   - Firestore will suggest indexes as needed
   - Likely need compound index on `status` + `created_at`

## Implementation Phases

### Phase 1: Project Setup ✅
- [x] Initialize Next.js 15 app with TypeScript
- [x] Install dependencies (Tailwind, Vercel AI SDK, Firebase, react-markdown)
- [x] Set up Tailwind CSS configuration
- [x] Create folder structure
- [x] Set up Firebase project and get credentials
- [x] Configure environment variables
- [x] Create Firestore initialization (`/lib/firestore.ts`)

### Phase 2: Data Layer ✅
- [x] Define TypeScript types (`/lib/types.ts`)
- [x] Set up Firestore admin SDK (server-side)
- [x] Set up Firestore client SDK (client-side for real-time)
- [x] Create AI utility functions (`/lib/ai.ts`)
- [x] Create prompt templates (`/lib/prompts.ts`)

### Phase 3: API Routes ✅
- [x] Build `/api/leads/submit` endpoint
- [x] Build `/api/leads/classify` endpoint (with Vercel AI SDK)
- [x] Build `/api/leads/generate-email` endpoint (with Vercel AI SDK)
- [x] Build `/api/leads/[id]/route` endpoint (GET/PATCH)
- [x] Build `/api/leads/[id]/review` endpoint
- [ ] Test all endpoints with sample data

### Phase 4: Customer Page
- [ ] Build `/app/page.tsx` - Customer lead submission page
- [ ] Create `LeadForm.tsx` component
- [ ] Add form validation
- [ ] Create `SuccessMessage.tsx` component
- [ ] Add success/error messaging
- [ ] Style with Tailwind CSS (public-facing design)
- [ ] Test form submission → Firestore

### Phase 5: SDR Dashboard Page
- [ ] Build `/app/dashboard/page.tsx` - SDR dashboard
- [ ] Create tab navigation component
- [ ] Create `ReviewQueue.tsx` component
- [ ] Create `SentEmails.tsx` component
- [ ] Create `AllLeads.tsx` component
- [ ] Create `DocsViewer.tsx` component (render REQUIREMENTS.md, DESIGN.md, PLAN.md)
- [ ] Create `LeadCard.tsx` component
- [ ] Create `EmailPreview.tsx` component (editable)
- [ ] Create `StatusBadge.tsx` component
- [ ] Implement real-time Firestore listeners

### Phase 6: Integration & Real-time Sync
- [ ] Test Firestore real-time listeners on dashboard
- [ ] Verify customer form → dashboard updates work
- [ ] Test opening both routes in separate tabs
- [ ] Ensure state syncs correctly across tabs

### Phase 7: End-to-End Testing
- [ ] End-to-end workflow testing
- [ ] Test AI classification with various lead types
- [ ] Test email generation quality
- [ ] Test human review actions
- [ ] Test real-time updates
- [ ] Fix any bugs or UX issues

### Phase 8: Polish
- [ ] Add loading states and animations
- [ ] Improve error handling
- [ ] Add helpful empty states
- [ ] Optimize performance
- [ ] Add comments and documentation
- [ ] Final styling and visual polish

### Phase 9: Deployment
- [ ] Deploy to Vercel
- [ ] Configure environment variables in Vercel
- [ ] Test in production environment
- [ ] Verify Firestore connection
- [ ] Verify AI SDK calls work

## Post-SLC Enhancements (Future)

- **Authentication**: Add NextAuth for admin access
- **Actual email sending**: Integrate Resend or SendGrid
- **Advanced analytics**: Charts, metrics dashboard, sorting accuracy
- **Prompt management UI**: Edit prompts in admin panel with versioning
- **Email templates**: Multiple template options
- **Batch operations**: Handle multiple leads at once
- **Export functionality**: Export lead data as CSV
- **Webhook integrations**: CRM sync, notifications
- **A/B testing**: Test different prompts and email styles

## Success Criteria (SLC)

✅ **Simple**:
- Single-page demo application
- Core workflow only
- Minimal feature set

✅ **Lovable**:
- Fast, responsive interface
- Real-time updates create "wow" moment
- AI classification and email generation work well
- Split-screen shows the magic happening

✅ **Complete**:
- End-to-end workflow functions
- Lead submission → Classification → Email generation → Review → Sent
- All core components work together
- Polished UI with Tailwind CSS
- Ready to demonstrate

## Notes
- Focus on getting the core workflow working smoothly
- AI prompts can be refined after seeing initial results
- Bias towards human review for safety (better to over-review than auto-send bad emails)
- Keep UI clean and uncluttered - this is a demo, not a production admin panel
- Real-time updates are key to the "demo magic" factor

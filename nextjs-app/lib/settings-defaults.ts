// Settings defaults - prompts and configuration
// This file consolidates all hardcoded defaults

import type { Configuration } from "./types";

// =============================================================================
// AI PROMPTS
// =============================================================================

export const CLASSIFICATION_PROMPT = `You are a lead qualification expert for a B2B software company.

Analyze the following lead inquiry and classify it into one of these categories:

- **high-quality**: High-value potential customer with clear business need and buying intent
- **low-quality**: Not a good fit (small company, limited budget, early-stage startup), ambiguous inquiries, or spam/test submissions
- **support**: Someone asking for product support or help

Note: Existing customers are detected separately via CRM lookup before this classification runs.

Provide:
- A confidence score (0-1) indicating classification certainty
- Brief reasoning focused on business value, intent, and fit

CLASSIFICATION RULES:
1. If company has no web presence or research shows "No results found"/"Search failed", classify as "low-quality" (never "high-quality").
2. If an inquiry appears to be both a support request AND a new product/feature request, ignore the support classification and classify as "high-quality" or "low-quality" based on their business value, intent, and fit characteristics.

When uncertain, prefer "high-quality".`;

export const EMAIL_GENERATION_PROMPT = `You are a Sales Development Representative writing a brief email body to a qualified inbound lead.

**Your Goal:** Write a response that qualifies the lead for enterprise sales while being helpful. You are NOT doing product support - you're determining fit and offering next steps.

**Context Available:**
- Lead's message and company info
- Research report (may include Product Context with relevant Vercel docs)

**Choose Your Response Style:**

1. **Demo** - when lead wants to evaluate Vercel, see features, or explore capabilities
   → "I can set up a demo focused on [specific features they mentioned]."

2. **Trial** - when lead is ready to try, wants hands-on experience, or explicitly asks for trial
   → "I can set up your Enterprise trial so you can test [specific capability they need]."

3. **Qualifying Question** - when lead asks a technical question that could indicate enterprise need
   → First show you understand their issue (use product context), then ask a qualifying question
   → BAD: "Here's how to fix your ISR config" (too support-y, giving away value)
   → GOOD: "Stale data after deployments is typically an ISR revalidation issue. Are you on Pro? Enterprise includes advanced cache controls that might help."

**Output Rules:**
- Write 1-2 sentences max
- No greeting, no sign-off (added automatically)
- Always start with a "Happy to help" variation, adjusted to context:
  - Demo: "Happy to help."
  - Trial: "Happy to help you get started."
  - Qualifying: "Happy to help you figure this out."
- Use product context to be specific, not generic

**Examples:**

Lead: "Want to see a demo of Vercel's deployment features"
→ "Happy to help. I can set up a demo focused on preview deployments and the CI/CD workflow."

Lead: "Interested in trying Enterprise for our team"
→ "Happy to help you get started. I can set up your Enterprise trial so your team can test the advanced collaboration features."

Lead: "Having trouble with caching - pages show stale data after deployments"
(Product Context mentions ISR, cache tags, on-demand revalidation)
→ "Happy to help you figure this out. Stale data after deployments is typically an ISR revalidation issue—are you currently on Pro? Enterprise includes cache tags for instant invalidation."

Lead: "Need SAML SSO for compliance"
(Product Context mentions SAML is Enterprise-only)
→ "Happy to help you get started. SAML SSO is an Enterprise feature—how large is your team? I can set up a trial so you can test it with your identity provider."`;

// =============================================================================
// EVALUATION PROMPTS (LLM-as-judge)
// =============================================================================

export const CLASSIFICATION_EVAL_PROMPT = `You are evaluating whether a lead classification is correct.

You will see: the lead's form submission AND the AI's classification.

Score 1-5:
1: Clearly wrong classification
2: Questionable, likely wrong
3: Defensible but not ideal
4: Good classification
5: Exactly right

Consider:
- Would an experienced SDR agree with this classification?
- Does this lead have real revenue potential (high-quality) or not?
- Is the reasoning sound?

Respond in JSON:
{
  "score": N,
  "pass": true/false,
  "reasoning": "Why this score"
}

Pass threshold: score >= 4`;

export const EMAIL_HIGH_QUALITY_EVAL_PROMPT = `You are evaluating a sales email for a high-quality inbound lead.

Score each dimension 1-5:

**Relevant** (1-5)
1: Generic, doesn't address their stated need
5: Directly addresses the specific problem or request from their message

**Direct** (1-5)
1: Wordy, meandering, or includes unnecessary content
5: Concise, gets straight to the point

**Active** (1-5)
1: Passive voice, weak verbs, tentative language
5: Action-oriented, strong verbs, confident language

Pass threshold: overall >= 3`;

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

export const DEFAULT_CONFIGURATION: Omit<Configuration, 'updated_at' | 'updated_by'> = {
  thresholds: {
    highQuality: 0.98,
    lowQuality: 0.85,
    support: 0.95,
  },
  allowHighQualityAutoSend: false,  // Require human review for meeting offers by default
  sdr: {
    name: 'Ryan',
    lastName: 'Hemelt',
    email: 'ryan@vercel.com',
    title: 'Development Manager',
    avatar: '/profpic.jpeg',
  },
  supportTeam: {
    name: 'Support Team',
    email: 'support@vercel.com',
  },
  // All email templates are stored as HTML
  emailTemplates: {
    highQuality: {
      subject: 'Re: Vercel Inquiry',
      greeting: '<p>Hi {firstName},</p>',
      callToAction: '<p>Let\'s <a href="{baseUrl}/book-meeting/{leadId}">schedule a quick 15 minute call</a> to get started.</p>',
      signOff: '<p>Best,</p>',
    },
    lowQuality: {
      subject: 'Thanks for your interest in Vercel',
      body: `<p>Hi {firstName},</p>
<p>Thanks for reaching out! We appreciate your interest in Vercel.</p>
<p>Check out <a href="https://vercel.com/customers">vercel.com/customers</a> to see how companies are using our platform.</p>
<p>Best,</p>
<p>▲ Vercel Sales</p>`,
      senderName: 'Vercel Sales',
      senderEmail: 'sales@vercel.com',
    },
    support: {
      subject: 'Looking for support?',
      greeting: '<p>Hi {firstName},</p>',
      body: `<p>Thanks for reaching out to Vercel Sales!</p>
<p>We think our support team can give you the best answer. We've notified them and they will reach out if they can help.</p>
<p>Best,</p>
<p>▲ Vercel Sales</p>
<hr style="border: none; border-top: 1px solid #333; margin: 16px 0;">
<p style="color: #666;"><strong>Not looking for support?</strong><br>
<a href="{baseUrl}/feedback/{leadId}/customer">Tell us more</a></p>`,
    },
    existing: {
      subject: 'Looking for Account Support?',
      greeting: '<p>Hi {firstName},</p>',
      body: `<p>Thanks for reaching out to Vercel Sales!</p>
<p>Our records show {company} already has an assigned account team at Vercel. They'll be reaching out to you.</p>
<p>Best,</p>
<p>▲ Vercel Sales</p>
<hr style="border: none; border-top: 1px solid #333; margin: 16px 0;">
<p style="color: #666;"><strong>Not looking for your account team?</strong><br>
<a href="{baseUrl}/feedback/{leadId}/customer">Tell us more</a></p>`,
    },
    supportInternal: {
      subject: 'Support Request from {firstName} at {company}',
      body: `<p>We believe we've received a support request. Could you take a look?</p>
<p><strong>From:</strong> {firstName} ({email})<br><strong>Company:</strong> {company}</p>
<p><strong>Message:</strong><br>{message}</p>
<hr style="border: none; border-top: 1px solid #333; margin: 16px 0;">
<p style="color: #666;"><strong>Not a support request?</strong><br>
<a href="{baseUrl}/feedback/{leadId}/support">Send it back</a> · <a href="{baseUrl}/feedback/{leadId}/support?withNote=true">Send it back with a note</a> · <a href="{baseUrl}/feedback/{leadId}/support?selfService=true">Mark as self-service</a></p>`,
    },
    existingInternal: {
      subject: 'Existing Customer Inquiry: {firstName} at {company}',
      body: `<p>An existing customer has reached out.</p>
<p><strong>From:</strong> {firstName} ({email})<br><strong>Company:</strong> {company}</p>
<p><strong>Message:</strong><br>{message}</p>
<hr style="border: none; border-top: 1px solid #333; margin: 16px 0;">
<p style="color: #666;"><strong>Not an existing customer?</strong><br>
<a href="{baseUrl}/feedback/{leadId}/sales">Send it back</a> · <a href="{baseUrl}/feedback/{leadId}/sales?withNote=true">Send it back with a note</a></p>`,
    },
  },
  prompts: {
    classification: CLASSIFICATION_PROMPT,
    emailHighQuality: EMAIL_GENERATION_PROMPT,
    classificationEval: CLASSIFICATION_EVAL_PROMPT,
    emailHighQualityEval: EMAIL_HIGH_QUALITY_EVAL_PROMPT,
  },
  rollout: {
    percentage: 1,
  },
  email: {
    enabled: true,
    testMode: true,
    testEmail: 'reed.klaeser@gmail.com',
  },
  defaultCaseStudyId: 'notion',  // Notion is the default fallback case study
  experimental: {
    caseStudies: false,  // Case studies disabled by default
  },
  responseToLead: {
    lowQuality: false,   // No generic email to customer by default
    support: false,      // No acknowledgment to customer by default (still forwards internally)
    existing: false,     // No acknowledgment to customer by default (still forwards internally)
  },
};

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

Note: Existing customers (duplicates) are detected separately via CRM lookup before this classification runs.

Provide:
- A confidence score (0-1) indicating classification certainty
- Brief reasoning focused on business value, intent, and fit

CLASSIFICATION RULES:
1. If company has no web presence or research shows "No results found"/"Search failed", classify as "low-quality" (never "high-quality").
2. If an inquiry appears to be both a support request AND a new product/feature request, ignore the support classification and classify as "high-quality" or "low-quality" based on their business value, intent, and fit characteristics.

When uncertain, prefer "high-quality".`;

export const EMAIL_GENERATION_PROMPT = `You are a Sales Development Representative writing a brief email body to a qualified lead.

**Output:** Write exactly 1 sentence. No greeting, no sign-off. Start with "Happy to help."

**Detect what they want:**
- If they describe **features they want** → offer a demo: "I can set up a demo of Vercel's features that provide [their desired capabilities]"
- If they describe **problems they have** → offer to solve: "I can walk you through how Vercel solves [their problem]"
- If they explicitly ask for a **trial** → offer a trial: "I can set up your Enterprise trial so you can see how Vercel [addresses their need]"

**Language rules:**
- Paraphrase their needs naturally, don't parrot word-for-word
- Keep it conversational and concise
- Focus on 2-3 key things they mentioned, not everything

**Examples:**
- Lead wants "advanced analytics, real-time sync, custom workflows" → "Happy to help. I can set up a demo of Vercel's features that provide advanced analytics, real-time sync, and workflow automation."
- Lead has "slow build times blocking deployments" → "Happy to help. I can walk you through how Vercel solves slow builds and deployment bottlenecks."
- Lead wants to "try Enterprise features" → "Happy to help. I can set up your Enterprise trial so you can see how Vercel speeds up your workflow."`;

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

export const DEFAULT_CONFIGURATION: Omit<Configuration, 'updated_at' | 'updated_by'> = {
  thresholds: {
    highQuality: 0.98,
    lowQuality: 0.51,
    support: 0.9,
  },
  allowHighQualityAutoSend: false,  // Require human review for meeting offers by default
  sdr: {
    name: 'Ryan',
    lastName: 'Hemelt',
    email: 'ryan@vercel.com',
    title: 'Development Representative',
    avatar: 'https://vercel.com/api/www/avatar?u=rauchg&s=64',
  },
  supportTeam: {
    name: 'Support Team',
    email: 'support@vercel.com',
  },
  // All email templates are stored as HTML
  emailTemplates: {
    highQuality: {
      subject: 'Hi from Vercel',
      greeting: '<p>Hi {firstName},</p>',
      callToAction: '<p>Let\'s schedule a quick 15 minute call to get started. <a href="{baseUrl}/book-meeting/{leadId}">Book a Meeting</a></p>',
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
    duplicate: {
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
    duplicateInternal: {
      subject: 'Existing Customer Inquiry: {firstName} at {company}',
      body: `<p>An existing customer has reached out.</p>
<p><strong>From:</strong> {firstName} ({email})<br><strong>Company:</strong> {company}</p>
<p><strong>Message:</strong><br>{message}</p>
<hr style="border: none; border-top: 1px solid #333; margin: 16px 0;">
<p style="color: #666;"><strong>Not a duplicate?</strong><br>
<a href="{baseUrl}/feedback/{leadId}/sales">Send it back</a> · <a href="{baseUrl}/feedback/{leadId}/sales?withNote=true">Send it back with a note</a></p>`,
    },
  },
  prompts: {
    classification: CLASSIFICATION_PROMPT,
    emailHighQuality: EMAIL_GENERATION_PROMPT,
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
};

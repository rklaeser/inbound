import {
  Experimental_Agent as Agent,
  stepCountIs,
  tool,
  generateObject,
} from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { LeadFormData, ClassificationResult, EmailGenerationResult } from './types';
import { findRelevantCaseStudies } from './case-study-matcher';
import { detectDuplicate } from './salesforce-mock';
import { CLASSIFICATION_PROMPT, EMAIL_GENERATION_PROMPT, GENERIC_EMAIL_PROMPT } from './prompts';

/**
 * Tools for Research Agent
 */

/**
 * Web search tool - searches for company information and professional profiles
 */
const webSearch = tool({
  description: 'Search the web for company information, news, and professional profiles',
  inputSchema: z.object({
    keywords: z
      .string()
      .describe('The search query (e.g. company name, industry, technology)'),
    resultCategory: z
      .enum([
        'linkedin profile',
        'company',
        'news',
        'financial report',
        'github'
      ])
      .describe('Type of content to prioritize in search results')
      .optional()
  }),
  execute: async ({ keywords, resultCategory }) => {
    // Check if EXA_API_KEY is available
    if (!process.env.EXA_API_KEY) {
      console.warn('⚠️ EXA_API_KEY not set - returning mock search results');
      return `Mock search results for "${keywords}": Company appears to be a ${resultCategory || 'business'} with online presence.`;
    }

    try {
      const Exa = (await import('exa-js')).default;
      const exa = new Exa(process.env.EXA_API_KEY);

      const result = await exa.searchAndContents(keywords, {
        numResults: 2,
        type: 'keyword',
        ...(resultCategory && { category: resultCategory }),
        summary: true,
        text: { maxCharacters: 500 }
      });

      // Format results as text
      const formatted = result.results
        .map((r: any) => `${r.title}: ${r.summary || r.text || ''}`)
        .join('\n\n');

      return formatted || 'No results found';
    } catch (error) {
      console.error('Exa search error:', error);
      return `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
});

/**
 * Case study finder - retrieves relevant customer success stories
 */
const findCaseStudies = tool({
  description: 'Find relevant case studies and customer success stories that match the lead',
  inputSchema: z.object({
    query: z
      .string()
      .describe('Search query for case studies (industry, use case, technology, etc.)')
  }),
  execute: async ({ query }) => {
    // Use our existing case study matcher
    const caseStudies = findRelevantCaseStudies(
      { company: query, message: query },
      3
    );

    if (caseStudies.length === 0) {
      return 'No relevant case studies found';
    }

    // Format case studies for the agent
    const formatted = caseStudies
      .map(cs => {
        const metrics = cs.metrics?.map(m => `${m.value} ${m.description}`).join(', ') || 'No metrics available';
        return `**${cs.company}**\nIndustry: ${cs.industry}\n${cs.description}\nKey Results: ${metrics}\nURL: ${cs.url}`;
      })
      .join('\n\n');

    return formatted;
  }
});

/**
 * Duplicate checker - verifies if lead is already in the system
 */
const checkDuplicates = tool({
  description: 'Check if this lead already exists as a customer or previous inquiry',
  inputSchema: z.object({
    email: z.string().email().describe('Email address to search for'),
    company: z.string().describe('Company name to search for')
  }),
  execute: async ({ email, company }) => {
    const duplicateCheck = detectDuplicate(email, company);

    if (duplicateCheck.isDuplicate && duplicateCheck.matchedContact) {
      const contact = duplicateCheck.matchedContact;
      return `DUPLICATE CUSTOMER FOUND: ${contact.company} is an existing ${contact.accountType} customer (${contact.status}). Account Team: ${contact.accountTeam}. Annual Value: $${contact.annualValue.toLocaleString()}. Match Reason: ${duplicateCheck.matchReason}`;
    }

    return 'No existing customer or duplicate found';
  }
});

/**
 * Research Agent
 */
export const leadResearcher = new Agent({
  model: openai('gpt-4o'),
  system: `You are a B2B sales research assistant analyzing inbound leads.

Your goal is to gather comprehensive information about the lead to help qualify them and personalize outreach.

Available tools:
- **webSearch**: Search for company information, recent news, and LinkedIn profiles (use resultCategory: 'linkedin profile' to find people)
- **findCaseStudies**: Retrieve customer success stories that match the lead's industry or use case
- **checkDuplicates**: Verify if this contact already exists in our CRM or is a previous inquiry

Research strategy:
1. First, check CRM for duplicates/existing customers
2. Search for the person's LinkedIn profile to verify their job title and seniority
3. Search for company information (size, industry, funding, recent news)
4. Look for relevant case studies in our knowledge base

IMPORTANT - Person Research:
- Always search for the person's LinkedIn profile using their name and company
- Extract and include their job title in your report
- Include the LinkedIn profile URL if found
- Use this information to assess their seniority and decision-making authority
- **CRITICAL**: If multiple people with the same name work at the company with different roles/seniority levels, and you cannot definitively determine which person submitted the lead, you MUST flag this as "AMBIGUOUS IDENTITY" in your report. Do NOT pick arbitrarily.

Synthesize your findings into a structured, concise report using this exact format:

**Person Information:**
Job Title: [person's job title, "Not found", or "AMBIGUOUS IDENTITY - Multiple [Name] found at [Company]"]
LinkedIn: [profile URL, "Not found", or "Multiple profiles found - cannot determine"]

**Company:**
Name: [company name]
Industry: [industry or "Unknown"]
Size: [employee count/size or "Unknown"]
Website: [website or "Not found"]

**CRM Status:**
Salesforce Lookup: [New / Existing Customer / Duplicate]
Account Team: [name or "N/A"]
Annual Value: [value or "N/A"]

**Relevant Case Studies:**
[List 1-2 relevant case study companies or "None found"]

**Red Flags:**
[List any concerns or "None"]

Keep each field concise - single line responses only. No paragraphs.`,
  tools: {
    webSearch,
    findCaseStudies,
    checkDuplicates
  },
  stopWhen: [stepCountIs(15)] // Max 15 tool calls
});

/**
 * Qualification Functions
 */
const classificationSchema = z.object({
  classification: z.enum(['high-quality', 'low-quality', 'support', 'duplicate', 'irrelevant']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string()
});

export async function qualifyLead(
  lead: LeadFormData,
  research: string
): Promise<ClassificationResult> {
  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: classificationSchema,
    prompt: `${CLASSIFICATION_PROMPT}

LEAD INFORMATION:
- Name: ${lead.name}
- Email: ${lead.email}
- Company: ${lead.company}
- Message: ${lead.message}

RESEARCH FINDINGS:
${research}

Classify this lead and provide your confidence score and reasoning.`
  });

  // VALIDATION: If research found a duplicate customer, override classification
  if (research.includes('DUPLICATE CUSTOMER FOUND') && object.classification !== 'duplicate') {
    console.warn(
      `[Workflow] AI classified as '${object.classification}' but research found duplicate customer. Overriding to 'duplicate'.`
    );
    return {
      classification: 'duplicate',
      confidence: 0.99,
      reasoning: `${object.reasoning} [OVERRIDE: CRM search confirmed this is an existing customer, so classification was changed from '${object.classification}' to 'duplicate' to ensure proper forwarding to their Account Team.]`
    };
  }

  return {
    classification: object.classification,
    confidence: object.confidence,
    reasoning: object.reasoning
  };
}

/**
 * Email Generation Functions
 */
const emailSchema = z.object({
  body: z.string().describe('The email body content')
});

export async function generateEmailForLead(
  lead: LeadFormData,
  research: string,
  classification: ClassificationResult
): Promise<EmailGenerationResult> {
  // Get configuration email template settings
  const { getConfiguration } = await import('./configuration-helpers');
  const { DEFAULT_CONFIGURATION } = await import('./types');

  const configuration = await getConfiguration();
  const template = configuration.emailTemplates?.highQuality || DEFAULT_CONFIGURATION.emailTemplates.highQuality;

  const firstName = lead.name.split(' ')[0];
  const greeting = template.greeting.replace('{firstName}', firstName);
  const signoff = `${template.signOff}\n\n${configuration.sdr.name}\n${configuration.sdr.email}`;

  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: emailSchema,
    prompt: `${EMAIL_GENERATION_PROMPT}

LEAD INFORMATION:
- Name: ${lead.name}
- Email: ${lead.email}
- Company: ${lead.company}
- Message: ${lead.message}

CLASSIFICATION:
- Category: ${classification.classification}
- Confidence: ${classification.confidence}
- Reasoning: ${classification.reasoning}

RESEARCH CONTEXT:
${research}

Generate ONLY the middle body content that addresses their specific inquiry and references relevant case studies. DO NOT include greeting or call-to-action - these will be added automatically.`
  });

  // Return only the AI-generated body content
  // Full email will be assembled at display/send time using template settings
  return {
    subject: template.subject,
    body: object.body
  };
}

export async function generateGenericEmail(
  lead: LeadFormData
): Promise<EmailGenerationResult> {
  const subject = 'Thanks for your interest in Vercel';
  const signoff = 'The Vercel Team\nsales@vercel.com';

  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: emailSchema,
    prompt: `${GENERIC_EMAIL_PROMPT}

LEAD INFORMATION:
- Name: ${lead.name}
- Company: ${lead.company}
- Message: ${lead.message}

Generate a brief, generic response email from Vercel directing them to self-service resources. Include the link to https://vercel.com/customers.`
  });

  return {
    subject: subject,
    body: object.body + '\n\n' + signoff
  };
}

// generateLowValueEmail removed - low-quality leads now use static template from configuration

export async function generateSupportEmail(
  lead: LeadFormData
): Promise<EmailGenerationResult> {
  // Get configuration for support template
  const { getConfiguration } = await import('./configuration-helpers');
  const { DEFAULT_CONFIGURATION } = await import('./types');
  const configuration = await getConfiguration();

  const template = configuration.emailTemplates?.support || DEFAULT_CONFIGURATION.emailTemplates.support;
  const firstName = lead.name.split(' ')[0];
  const greeting = template.greeting.replace('{firstName}', firstName);
  const signoff = `${template.signOff}\n\n${template.senderName}\n${template.senderEmail}`;

  // Construct full email (no AI generation needed for support - use template directly)
  const fullBody = `${greeting}\n\n${template.callToAction}\n\n${signoff}`;

  return {
    subject: template.subject,
    body: fullBody
  };
}

export async function generateDuplicateEmail(
  lead: LeadFormData
): Promise<EmailGenerationResult> {
  // Get configuration for duplicate template
  const { getConfiguration } = await import('./configuration-helpers');
  const { DEFAULT_CONFIGURATION } = await import('./types');
  const configuration = await getConfiguration();

  const template = configuration.emailTemplates?.duplicate || DEFAULT_CONFIGURATION.emailTemplates.duplicate;
  const firstName = lead.name.split(' ')[0];
  const greeting = template.greeting.replace('{firstName}', firstName);
  const signoff = `${template.signOff}\n\n${template.senderName}\n${template.senderEmail}`;

  // Construct full email (no AI generation needed for duplicate - use template directly)
  const fullBody = `${greeting}\n\n${template.callToAction}\n\n${signoff}`;

  return {
    subject: template.subject,
    body: fullBody
  };
}

import {
  Experimental_Agent as Agent,
  stepCountIs,
  tool,
  generateObject,
} from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { LeadFormData, ClassificationResult, EmailGenerationResult } from './types';

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

      // Format results as text with source URLs
      const formatted = result.results
        .map((r: any) => {
          const content = r.summary || r.text || '';
          const source = r.url ? `\nSource: ${r.url}` : '';
          return `${r.title}: ${content}${source}`;
        })
        .join('\n\n');

      return formatted || 'No results found';
    } catch (error) {
      console.error('Exa search error:', error);
      return `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
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

Research strategy:
1. Search for the person's LinkedIn profile to verify their job title and seniority
2. Search for company information (size, industry, funding, recent news)

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

**Red Flags:**
[List any concerns or "None"]

**Sources:**
[List URLs from your searches that support key findings - especially for verifying job titles, company info, or news. Format as markdown links: [Article Title](URL)]

Keep each field concise - single line responses only. No paragraphs.`,
  tools: {
    webSearch,
  },
  stopWhen: [stepCountIs(15)] // Max 15 tool calls
});

/**
 * Qualification Functions
 */
const classificationSchema = z.object({
  // Note: 'duplicate' is handled deterministically by CRM check, not by AI classification
  classification: z.enum(['high-quality', 'low-quality', 'support']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export async function qualifyLead(
  lead: LeadFormData,
  research: string
): Promise<ClassificationResult> {
  // Note: Duplicate detection is handled deterministically before this function is called.
  // This function only runs for non-duplicate leads.
  const { getConfiguration } = await import('./configuration-helpers');
  const { DEFAULT_CONFIGURATION } = await import('./types');
  const configuration = await getConfiguration();
  const classificationPrompt = configuration.prompts?.classification || DEFAULT_CONFIGURATION.prompts.classification;

  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: classificationSchema,
    prompt: `${classificationPrompt}

LEAD INFORMATION:
- Name: ${lead.name}
- Email: ${lead.email}
- Company: ${lead.company}
- Message: ${lead.message}

RESEARCH FINDINGS:
${research}

Classify this lead and provide your confidence score and reasoning.`
  });

  return {
    classification: object.classification,
    confidence: object.confidence,
    reasoning: object.reasoning,
    existingCustomer: false, // Only non-duplicates reach this function
  };
}

/**
 * Email Generation Functions
 */
const emailSchema = z.object({
  body: z.string().describe('The email body content'),
});

/**
 * Convert plain text to HTML paragraphs
 * Split on double newlines for paragraphs, preserve single newlines as <br>
 */
function textToHtml(text: string): string {
  if (!text) return '';
  return text
    .split('\n\n')
    .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

export async function generateEmailForLead(
  lead: LeadFormData
): Promise<EmailGenerationResult> {
  // Get configuration email template settings
  const { getConfiguration } = await import('./configuration-helpers');
  const { DEFAULT_CONFIGURATION } = await import('./types');

  const configuration = await getConfiguration();
  const template = configuration.emailTemplates?.highQuality || DEFAULT_CONFIGURATION.emailTemplates.highQuality;
  const emailPrompt = configuration.prompts?.emailHighQuality || DEFAULT_CONFIGURATION.prompts.emailHighQuality;

  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: emailSchema,
    prompt: `${emailPrompt}

LEAD INFORMATION:
- Name: ${lead.name}
- Email: ${lead.email}
- Company: ${lead.company}
- Message: ${lead.message}

Generate ONLY the middle body content. DO NOT include greeting, sign-off, or call-to-action - these will be added automatically.`
  });

  // Convert AI-generated plain text to HTML paragraphs
  // Full email will be assembled at display/send time using template settings
  return {
    subject: template.subject,
    body: textToHtml(object.body),
    includedCaseStudies: []
  };
}


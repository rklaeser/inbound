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
 * Exa Search Infrastructure
 * Shared client and helpers for all Exa-based search tools
 */

// Lazy-initialized Exa client (singleton)
let exaClient: InstanceType<typeof import('exa-js').default> | null = null;

async function getExaClient() {
  if (!process.env.EXA_API_KEY) {
    return null;
  }
  if (!exaClient) {
    const Exa = (await import('exa-js')).default;
    exaClient = new Exa(process.env.EXA_API_KEY);
  }
  return exaClient;
}

type ExaCategory =
  | 'linkedin profile'
  | 'company'
  | 'news'
  | 'financial report'
  | 'github'
  | 'research paper'
  | 'pdf'
  | 'tweet'
  | 'personal site';

interface ExaSearchOptions {
  numResults: number;
  maxCharacters: number;
  includeDomains?: string[];
  category?: ExaCategory;
}

interface ExaSearchResult {
  title?: string | null;
  summary?: string | null;
  text?: string | null;
  url?: string | null;
}

function formatExaResults(results: ExaSearchResult[], fallbackMessage: string): string {
  if (!results.length) return fallbackMessage;

  return results
    .map((r) => {
      const content = r.summary || r.text || '';
      const source = r.url ? `\nSource: ${r.url}` : '';
      return `${r.title}: ${content}${source}`;
    })
    .join('\n\n');
}

async function executeExaSearch(
  query: string,
  options: ExaSearchOptions,
  context: { toolName: string; fallbackMessage: string; mockResponse?: string }
): Promise<string> {
  const client = await getExaClient();

  if (!client) {
    console.warn(`⚠️ EXA_API_KEY not set - ${context.toolName} unavailable`);
    return context.mockResponse || context.fallbackMessage;
  }

  try {
    const result = await client.searchAndContents(query, {
      numResults: options.numResults,
      type: 'keyword',
      ...(options.includeDomains && { includeDomains: options.includeDomains }),
      ...(options.category && { category: options.category }),
      summary: true,
      text: { maxCharacters: options.maxCharacters },
    });

    return formatExaResults(result.results, context.fallbackMessage);
  } catch (error) {
    console.error(`${context.toolName} error:`, error);
    return `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

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
  execute: async ({ keywords, resultCategory }) =>
    executeExaSearch(
      keywords,
      { numResults: 2, maxCharacters: 500, category: resultCategory },
      {
        toolName: 'webSearch',
        fallbackMessage: 'No results found',
        mockResponse: `Mock search results for "${keywords}": Company appears to be a ${resultCategory || 'business'} with online presence.`,
      }
    ),
});

/**
 * Vercel docs search tool - searches vercel.com for product information
 */
const searchVercelDocs = tool({
  description: 'Search Vercel documentation for product features, pricing, plans, and technical details. Use when the lead asks technical questions about Vercel capabilities.',
  inputSchema: z.object({
    query: z.string().describe('What to search for in Vercel docs'),
  }),
  execute: async ({ query }) =>
    executeExaSearch(
      query,
      { numResults: 3, maxCharacters: 1000, includeDomains: ['vercel.com'] },
      {
        toolName: 'searchVercelDocs',
        fallbackMessage: 'No results found in Vercel docs',
      }
    ),
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
- **searchVercelDocs**: Search Vercel documentation for product features, pricing, and technical details

Research strategy:
1. Search for the person's LinkedIn profile to verify their job title and seniority
2. Search for company information (size, industry, funding, recent news)
3. If the lead's message asks technical questions about Vercel features, pricing, or capabilities, use searchVercelDocs to look up accurate information

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

**Product Context:** (only include if lead asked technical questions)
[Relevant Vercel product information from docs search]

**Red Flags:**
[List any concerns or "None"]

**Sources:**
[List URLs from your searches that support key findings - especially for verifying job titles, company info, or news. Format as markdown links: [Article Title](URL)]

Keep each field concise - single line responses only. No paragraphs.`,
  tools: {
    webSearch,
    searchVercelDocs,
  },
  stopWhen: [stepCountIs(15)] // Max 15 tool calls
});

/**
 * Qualification Functions
 */
const classificationSchema = z.object({
  // Note: 'existing' is handled deterministically by CRM check, not by AI classification
  classification: z.enum(['high-quality', 'low-quality', 'support']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export async function qualifyLead(
  lead: LeadFormData,
  research: string
): Promise<ClassificationResult> {
  // Note: Existing customer detection is handled deterministically before this function is called.
  // This function only runs for non-existing customer leads.
  const { getConfiguration } = await import('./configuration-helpers');
  const { DEFAULT_CONFIGURATION } = await import('./types');
  const { getActiveExamples, formatExamplesForPrompt } = await import('./examples-service');

  const configuration = await getConfiguration();
  const classificationPrompt = configuration.prompts?.classification || DEFAULT_CONFIGURATION.prompts.classification;

  // Fetch active few-shot examples (max 5)
  let examplesSection = '';
  let examplesCount = 0;
  try {
    const activeExamples = await getActiveExamples(5);
    examplesCount = activeExamples.length;
    examplesSection = formatExamplesForPrompt(activeExamples);
    console.log(`[qualifyLead] Loaded ${examplesCount} active examples for few-shot learning`);
  } catch (error) {
    console.error('[qualifyLead] Failed to fetch examples (non-fatal):', error);
    // Continue without examples if fetch fails
  }

  const fullPrompt = `${classificationPrompt}

${examplesSection}LEAD INFORMATION:
- Name: ${lead.name}
- Email: ${lead.email}
- Company: ${lead.company}
- Message: ${lead.message}

RESEARCH FINDINGS:
${research}

Classify this lead and provide your confidence score and reasoning.`;

  console.log('[qualifyLead] Classification prompt:', fullPrompt);

  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: classificationSchema,
    prompt: fullPrompt
  });

  console.log('[qualifyLead] Classification result:', {
    classification: object.classification,
    confidence: object.confidence,
    examplesUsed: examplesCount,
  });

  return {
    classification: object.classification,
    confidence: object.confidence,
    reasoning: object.reasoning,
    existingCustomer: false, // Only non-existing-customer leads reach this function
  };
}

/**
 * Email Generation Functions
 */
const emailSchema = z.object({
  body: z.string().describe('The email body content'),
  responseStyle: z.enum(['demo', 'trial', 'qualifying']).describe('The response style: demo (showing features), trial (hands-on experience), or qualifying (asking clarifying questions)'),
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
  lead: LeadFormData,
  researchReport: string
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

RESEARCH REPORT:
${researchReport}`
  });

  // Convert AI-generated plain text to HTML paragraphs
  // Full email will be assembled at display/send time using template settings
  return {
    subject: template.subject,
    body: textToHtml(object.body),
    includedCaseStudies: [],
    responseStyle: object.responseStyle,
  };
}


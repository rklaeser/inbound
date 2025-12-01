import {
  Experimental_Agent as Agent,
  stepCountIs,
  tool,
  generateObject,
} from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { LeadFormData, ClassificationResult, EmailGenerationResult } from './types';
import { findCaseStudiesByProblemFit, findCaseStudiesByIndustryFit } from './case-study-matcher';
import { CLASSIFICATION_PROMPT, EMAIL_GENERATION_PROMPT } from './prompts';

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
 * Case study finder - retrieves relevant customer success stories organized by problem fit and industry fit
 */
const findCaseStudies = tool({
  description: 'Find relevant case studies organized by problem fit (based on use case/needs) and industry fit (based on company industry). Call this AFTER discovering the company industry via web search.',
  inputSchema: z.object({
    company: z
      .string()
      .describe('The lead company name'),
    message: z
      .string()
      .describe('The lead inquiry message'),
    industry: z
      .string()
      .optional()
      .describe('The industry discovered from your research (e.g., "AI", "Retail", "Healthcare", "Software", "Finance")')
  }),
  execute: async ({ company, message, industry }) => {
    const lead = { company, message };

    // Get case studies by problem fit (based on use case keywords in message)
    const problemFitMatches = await findCaseStudiesByProblemFit(lead, 2);

    // Get case studies by industry fit (using agent-discovered industry)
    const industryFitMatches = await findCaseStudiesByIndustryFit(industry, 2);

    // Format problem fit section
    let result = '**Case Studies by Problem Fit:**\n';
    if (problemFitMatches.length === 0) {
      result += 'None found\n';
    } else {
      problemFitMatches.forEach(match => {
        const cs = match.caseStudy;
        result += `- **${cs.company}** (${cs.industry}): ${cs.featuredText} URL: ${cs.url}\n`;
      });
    }

    // Format industry fit section
    result += '\n**Case Studies by Industry Fit:**\n';
    if (industryFitMatches.length === 0) {
      result += industry ? `None found for industry: ${industry}\n` : 'No industry provided\n';
    } else {
      industryFitMatches.forEach(match => {
        const cs = match.caseStudy;
        result += `- **${cs.company}** (${cs.industry}): ${cs.featuredText} URL: ${cs.url}\n`;
      });
    }

    return result;
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
- **findCaseStudies**: Retrieve customer success stories organized by problem fit and industry fit. Pass the company name, their inquiry message, and the industry you discovered to get relevant case studies.

Research strategy:
1. Search for the person's LinkedIn profile to verify their job title and seniority
2. Search for company information (size, industry, funding, recent news) - IMPORTANT: Note the industry for the next step
3. Call findCaseStudies with the company name, message, AND the industry you discovered to get case studies organized by problem fit and industry fit

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

**Relevant Case Studies (Problem Fit):**
[List up to 2 case studies matching the lead's problem/use case with "[Company](URL)" links or "None found"]

**Relevant Case Studies (Industry Fit):**
[List up to 2 case studies from the lead's industry with "[Company](URL)" links or "None found"]

**Red Flags:**
[List any concerns or "None"]

**Sources:**
[List URLs from your searches that support key findings - especially for verifying job titles, company info, or news. Format as markdown links: [Article Title](URL)]

Keep each field concise - single line responses only. No paragraphs.`,
  tools: {
    webSearch,
    findCaseStudies,
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

  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: emailSchema,
    prompt: `${EMAIL_GENERATION_PROMPT}

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

// generateGenericEmail and generateLowValueEmail removed - low-quality leads now use static template from configuration

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

  // Construct full email HTML (templates are already HTML)
  const fullBody = `${greeting}${template.body}`;

  return {
    subject: template.subject,
    body: fullBody,
    includedCaseStudies: []
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

  // Construct full email HTML (templates are already HTML)
  const fullBody = `${greeting}${template.body}`;

  return {
    subject: template.subject,
    body: fullBody,
    includedCaseStudies: []
  };
}

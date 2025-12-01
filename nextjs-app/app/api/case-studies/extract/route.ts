import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import {
  createCaseStudy,
  INDUSTRIES,
  PRODUCTS,
  type Industry,
  type VercelProduct,
} from '@/lib/case-studies';

const caseStudySchema = z.object({
  company: z.string().describe('The company name featured in the case study'),
  industry: z.enum(INDUSTRIES as [string, ...string[]]).describe('The industry of the company'),
  products: z.array(z.enum(PRODUCTS as [string, ...string[]])).describe('Vercel products mentioned in the case study'),
});

async function fetchPageContent(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; InboundBot/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  // Basic HTML to text extraction - remove scripts, styles, and tags
  let text = html
    // Remove script and style elements
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove HTML tags but keep content
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Limit to ~8000 chars to avoid token limits
  if (text.length > 8000) {
    text = text.substring(0, 8000) + '...';
  }

  return text;
}

/**
 * POST /api/case-studies/extract
 * Extracts case study data from a URL using AI
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, logoSvg, featuredText } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    if (!logoSvg) {
      return NextResponse.json(
        { success: false, error: 'Logo SVG is required' },
        { status: 400 }
      );
    }

    if (!featuredText) {
      return NextResponse.json(
        { success: false, error: 'Featured text is required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL provided' },
        { status: 400 }
      );
    }

    // Fetch the page content
    console.log(`[Case Study Extract] Fetching ${url}...`);
    let pageContent: string;
    try {
      pageContent = await fetchPageContent(url);
    } catch (error) {
      console.error('[Case Study Extract] Fetch error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch the URL. Please check if the URL is accessible.' },
        { status: 400 }
      );
    }

    if (pageContent.length < 100) {
      return NextResponse.json(
        { success: false, error: 'Page content appears to be empty or too short' },
        { status: 400 }
      );
    }

    // Use AI to extract case study data
    console.log('[Case Study Extract] Extracting case study data with AI...');
    const { object: caseStudyData } = await generateObject({
      model: openai('gpt-4o'),
      schema: caseStudySchema,
      prompt: `Extract case study information from the following webpage content. This is a customer success story page.

PAGE URL: ${url}

PAGE CONTENT:
${pageContent}

Extract the following information:
1. Company name - the customer featured in the case study
2. Industry - categorize into one of: ${INDUSTRIES.join(', ')}
3. Products - which Vercel products are mentioned: ${PRODUCTS.join(', ')}`
    });

    // Create the case study with provided logo and featured text
    console.log(`[Case Study Extract] Creating case study for ${caseStudyData.company}...`);
    const id = await createCaseStudy({
      ...caseStudyData,
      url,
      industry: caseStudyData.industry as Industry,
      products: caseStudyData.products as VercelProduct[],
      logoSvg,
      featuredText,
    });

    return NextResponse.json({
      success: true,
      data: { id, ...caseStudyData },
    });
  } catch (error) {
    console.error('[Case Study Extract] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extract case study',
      },
      { status: 500 }
    );
  }
}

import { NextRequest } from 'next/server';
import type { CaseStudy } from '@/lib/case-studies/types';

/**
 * Create a mock NextRequest for testing API routes
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
) {
  const { method = 'GET', body, headers = {} } = options;

  const requestHeaders = new Headers({
    'Content-Type': 'application/json',
    ...headers,
  });

  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * Parse JSON response from NextResponse
 */
export async function parseResponse<T = unknown>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

/**
 * Standard API success response shape
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Standard API error response shape
 */
export interface ErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

/**
 * Create mock params for dynamic routes
 */
export function createMockParams<T extends Record<string, string>>(params: T): Promise<T> {
  return Promise.resolve(params);
}

/**
 * Sample lead data for testing
 */
export const sampleLead = {
  id: 'lead-123',
  submission: {
    leadName: 'John Doe',
    email: 'john@example.com',
    company: 'Acme Inc',
    message: 'Interested in your product',
  },
  status: {
    status: 'review' as const,
    received_at: new Date('2024-01-15T10:00:00Z'),
  },
  classifications: [],
  bot_research: {
    classification: 'high-quality' as const,
    confidence: 0.85,
    reasoning: 'Strong company fit',
    timestamp: new Date('2024-01-15T10:01:00Z'),
  },
};

/**
 * Sample case study data for testing
 */
export const sampleCaseStudy: CaseStudy = {
  id: 'cs-123',
  company: 'TechCorp',
  industry: 'Software',
  products: ['Next.js', 'Analytics'],
  url: 'https://vercel.com/customers/techcorp',
  logoSvg: '<svg></svg>',
  featuredText: 'TechCorp improved performance by 50%',
};

/**
 * Sample configuration for testing
 */
export const sampleConfiguration = {
  thresholds: {
    highQuality: 0.8,
    lowQuality: 0.3,
    support: 0.7,
    existing: 0.9,
  },
  sdr: {
    name: 'Jane Smith',
    lastName: 'Smith',
    email: 'jane@company.com',
    title: 'Sales Development Representative',
  },
  supportTeam: {
    name: 'Support Team',
    email: 'support@company.com',
  },
  emailTemplates: {
    highQuality: {
      subject: 'Welcome!',
      greeting: 'Hi {{firstName}},',
      callToAction: 'Book a meeting',
      signOff: 'Best regards,',
    },
    lowQuality: {
      subject: 'Thanks for reaching out',
      body: 'We received your message.',
      senderName: 'Team',
      senderEmail: 'team@company.com',
    },
    support: {
      subject: 'Support Request Received',
      greeting: 'Hello,',
      body: 'Our support team will assist you.',
    },
    existing: {
      subject: 'Welcome back',
      greeting: 'Hello,',
      body: 'We see you are already a customer.',
    },
    supportInternal: {
      subject: 'New support request',
      body: 'A new support request has been submitted.',
    },
    existingInternal: {
      subject: 'Existing customer detected',
      body: 'This lead is already in our CRM.',
    },
  },
  prompts: {
    classification: 'Classify this lead',
    emailHighQuality: 'Write a personalized email',
  },
  rollout: {
    enabled: false,
    percentage: 0,
  },
  email: {
    enabled: true,
    testMode: true,
    testEmail: 'test@example.com',
  },
  allowHighQualityAutoSend: false,
  defaultCaseStudyId: null,
  experimental: {
    caseStudies: true,
  },
};

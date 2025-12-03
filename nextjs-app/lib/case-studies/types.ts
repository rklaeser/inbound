// Case study type definitions

export type Industry =
  | 'Software'
  | 'AI'
  | 'Retail'
  | 'Business Services'
  | 'Finance & Insurance'
  | 'Media'
  | 'Healthcare'
  | 'Energy & Utilities';

export type VercelProduct =
  | 'Next.js'
  | 'Preview Deployments'
  | 'Integrations'
  | 'ISR'
  | 'Edge Functions'
  | 'Image Optimization'
  | 'Analytics'
  | 'Vercel AI SDK';

export interface CaseStudy {
  id: string;
  company: string;
  industry: Industry;
  products: VercelProduct[];
  url: string;
  logoSvg: string;           // Raw SVG markup stored in Firestore (required)
  featuredText: string;      // Featured text from Vercel's customer page (required)
  full_article_text?: string; // Full article content for embedding generation
}

export const INDUSTRIES: Industry[] = [
  'Software',
  'AI',
  'Retail',
  'Business Services',
  'Finance & Insurance',
  'Media',
  'Healthcare',
  'Energy & Utilities',
];

export const PRODUCTS: VercelProduct[] = [
  'Next.js',
  'Preview Deployments',
  'Integrations',
  'ISR',
  'Edge Functions',
  'Image Optimization',
  'Analytics',
  'Vercel AI SDK',
];

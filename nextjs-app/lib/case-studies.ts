// Case study type definitions
// Data is stored in Firestore - see firebase-case-studies.ts for data access

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
  logoSvg: string;       // Raw SVG markup stored in Firestore (required)
  featuredText: string;  // Featured text from Vercel's customer page (required)
}

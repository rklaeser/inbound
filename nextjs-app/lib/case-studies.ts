// Structured case study data from Vercel customers
// Data sourced from vercel.com/customers

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

export interface CaseStudyMetric {
  value: string;
  description: string;
}

export interface CaseStudy {
  id: string;
  company: string;
  industry: Industry;
  description: string;
  metrics?: CaseStudyMetric[];
  products: VercelProduct[];
  url: string;
  quote?: string;
  quotedPerson?: {
    name: string;
    title: string;
  };
}

// Case studies database - all data is real and sourced from Vercel's website
export const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'notion',
    company: 'Notion',
    industry: 'Software',
    description: 'What once took an hour to deploy a hotfix now takes just 15 minutes, and rolling back changes happens in seconds.',
    metrics: [
      {
        value: '15 minutes',
        description: 'Deploy time (from 1 hour)'
      },
      {
        value: 'Seconds',
        description: 'Rollback time'
      }
    ],
    products: ['Next.js', 'Preview Deployments'],
    url: 'https://vercel.com/blog/how-notion-powers-rapid-and-performant-experimentation',
  },
  {
    id: 'paige',
    company: 'PAIGE',
    industry: 'Healthcare',
    description: 'With Vercel, PAIGE boosted their Black Friday revenue by 22% and increased conversion rates by 76%.',
    metrics: [
      {
        value: '22%',
        description: 'Black Friday revenue increase'
      },
      {
        value: '76%',
        description: 'Conversion rate increase'
      }
    ],
    products: ['Next.js', 'Edge Functions', 'Preview Deployments'],
    url: 'https://vercel.com/blog/how-paige-grew-revenue-by-22-with-shopify-next-js-and-vercel',
  },
  {
    id: 'leonardo-ai',
    company: 'Leonardo.AI',
    industry: 'AI',
    description: 'Switching to Vercel transformed our workflow, cutting build times from 10 minutes to just 2 minutes.',
    metrics: [
      {
        value: '80%',
        description: 'Build time reduction'
      },
      {
        value: '2 minutes',
        description: 'New build time (from 10 minutes)'
      }
    ],
    products: ['Next.js', 'Preview Deployments', 'Vercel AI SDK'],
    url: 'https://vercel.com/customers/leonardo-ai-performantly-generates-4-5-million-images-daily-with-next-js-and-vercel',
    quote: 'Switching to Vercel transformed our workflow, cutting build times from 10 minutes to just 2 minutes.',
    quotedPerson: {
      name: 'Peter Runham',
      title: 'Co-Founder & CTO'
    }
  },
  {
    id: 'sonos',
    company: 'Sonos',
    industry: 'Retail',
    description: 'Our developers are happier, we get to market faster. Vercel let us move with confidence.',
    products: ['Next.js', 'Preview Deployments', 'Edge Functions'],
    url: 'https://vercel.com/customers/how-sonos-amplified-their-devex',
    quote: 'Our developers are happier, we get to market faster. Vercel let us move with confidence.',
    quotedPerson: {
      name: 'Jonathan Lemon',
      title: 'Software Engineering Manager'
    }
  },
  {
    id: 'stripe',
    company: 'Stripe',
    industry: 'Finance & Insurance',
    description: 'Stripe builds viral Black Friday site in 19 days with Vercel.',
    metrics: [
      {
        value: '19 days',
        description: 'Time to build viral campaign'
      }
    ],
    products: ['Next.js', 'Preview Deployments', 'ISR'],
    url: 'https://vercel.com/customers/architecting-reliability-stripes-black-friday-site',
  },
  {
    id: 'helly-hansen',
    company: 'Helly Hansen',
    industry: 'Retail',
    description: 'Helly Hansen migrated to Vercel and drove 80% Black Friday growth.',
    metrics: [
      {
        value: '80%',
        description: 'Black Friday growth'
      }
    ],
    products: ['Next.js', 'Preview Deployments', 'Image Optimization', 'Edge Functions'],
    url: 'https://vercel.com/blog/how-helly-hansen-migrated-to-vercel-and-drove-80-black-friday-growth',
  },
  {
    id: 'remarkable',
    company: 'reMarkable',
    industry: 'Retail',
    description: 'Incrementally adopting Next.js at one of Europe\'s fastest growing brands.',
    metrics: [
      {
        value: '87%',
        description: 'Decrease in build times'
      }
    ],
    products: ['Next.js', 'ISR', 'Preview Deployments', 'Integrations'],
    url: 'https://vercel.com/blog/incrementally-adopting-next-js-at-one-of-europes-fastest-growing-brands',
  },
  {
    id: 'ruggable',
    company: 'Ruggable',
    industry: 'Retail',
    description: 'Ruggable achieved significant performance and SEO improvements by migrating to a headless architecture powered by Vercel.',
    metrics: [
      {
        value: '75%',
        description: 'Increase in search rankings'
      },
      {
        value: '40%',
        description: 'Faster site speed'
      },
      {
        value: '300%',
        description: 'Increase in unbranded search clicks'
      }
    ],
    products: ['Next.js', 'Preview Deployments', 'Analytics'],
    url: 'https://vercel.com/blog/how-ruggable-saw-more-organic-clicks-by-optimizing-their-frontend',
  },
  {
    id: 'scale-ai',
    company: 'Scale AI',
    industry: 'AI',
    description: 'Scale\'s small design team creates enterprise-grade products by leveraging Vercel and Next.js with minimal resources.',
    products: ['Next.js', 'Preview Deployments', 'Analytics'],
    url: 'https://vercel.com/customers/scale-unifies-design-and-performance-with-next-js-and-vercel',
    quote: 'Vercel gives us the ability to create gorgeous apps and models with less resources. Customers and stakeholders would assume we had a full design team…they had no idea it was just one other frontend developer and me!',
    quotedPerson: {
      name: 'Ricky Rauch',
      title: 'Designer at Scale'
    }
  },
  {
    id: 'cruise-critic',
    company: 'Cruise Critic',
    industry: 'Media',
    description: 'Cruise Critic migrated from monolithic PHP to Next.js on Vercel, enabling faster development and significantly improved site performance.',
    metrics: [
      {
        value: '85%',
        description: 'Decrease in page download time'
      },
      {
        value: '8 minutes',
        description: 'Build time (from 30 minutes)'
      }
    ],
    products: ['Next.js'],
    url: 'https://vercel.com/blog/a-better-developer-experience-makes-building-cruise-critic-more-efficient',
    quote: 'The most valuable feature of Vercel is that our team can focus on building products rather than worrying about infrastructure.',
    quotedPerson: {
      name: 'Robert Norman',
      title: 'Principal Software Engineer'
    }
  },
  {
    id: 'hydrow',
    company: 'Hydrow',
    industry: 'Retail',
    description: 'Hydrow transformed their content authoring workflow and site performance by migrating to a headless architecture with Next.js and Vercel.',
    metrics: [
      {
        value: '3000%',
        description: 'Faster website updates'
      },
      {
        value: '50%',
        description: 'Improvement in Core Web Vitals'
      }
    ],
    products: ['Next.js', 'ISR', 'Preview Deployments', 'Edge Functions'],
    url: 'https://vercel.com/customers/hydrow',
    quote: 'With Vercel, Next.js, and Contentful we finally have that feeling of: \'it just works.\'',
    quotedPerson: {
      name: 'Reuben Kabel',
      title: 'Senior Vice President of Engineering'
    }
  },
  {
    id: 'devolver',
    company: 'Devolver Digital',
    industry: 'Media',
    description: 'Small engineering team reduced system management time by over 50% and launched five websites during a 30-minute press conference without issues.',
    metrics: [
      {
        value: '73%',
        description: 'Faster game website deployment'
      },
      {
        value: '50%',
        description: 'Reduction in system management time'
      }
    ],
    products: ['Next.js', 'Preview Deployments'],
    url: 'https://vercel.com/blog/devolver-ships-game-websites-73-faster-with-vercel',
    quote: 'Our sites just work. We are never \'on-call\' in case there\'s a problem. We don\'t have to plan around traffic surges. Vercel is our CloudOps team.',
    quotedPerson: {
      name: 'Eli Penner',
      title: 'Web Developer'
    }
  },
  {
    id: 'morning-brew',
    company: 'Morning Brew',
    industry: 'Media',
    description: 'Morning Brew scaled from an email newsletter into a multi-platform media brand serving millions with a headless architecture.',
    metrics: [
      {
        value: '2.5x',
        description: 'Revenue increase after frontend cloud adoption'
      },
      {
        value: '100%',
        description: 'Cache hit rate with on-demand ISR'
      }
    ],
    products: ['Next.js', 'ISR', 'Preview Deployments'],
    url: 'https://vercel.com/blog/from-newsletter-to-global-media-brand-with-a-headless-frontend',
    quote: 'By thinking of content as data and removing the HTML semantics, we can let editors and content creators do what they do best.',
    quotedPerson: {
      name: 'Drew Monroe',
      title: 'Director of Engineering'
    }
  }
];

/**
 * Get case studies by industry
 */
export function getCaseStudiesByIndustry(industry: Industry): CaseStudy[] {
  return CASE_STUDIES.filter(cs => cs.industry === industry);
}

/**
 * Get case studies by product
 */
export function getCaseStudiesByProduct(product: VercelProduct): CaseStudy[] {
  return CASE_STUDIES.filter(cs => cs.products.includes(product));
}

/**
 * Get case study by company name (fuzzy match)
 */
export function getCaseStudyByCompany(company: string): CaseStudy | undefined {
  const searchTerm = company.toLowerCase();
  return CASE_STUDIES.find(
    cs => cs.company.toLowerCase().includes(searchTerm) ||
          searchTerm.includes(cs.company.toLowerCase())
  );
}

/**
 * Search case studies by keywords in description
 */
export function searchCaseStudies(query: string): CaseStudy[] {
  const searchTerm = query.toLowerCase();
  return CASE_STUDIES.filter(cs =>
    cs.description.toLowerCase().includes(searchTerm) ||
    cs.company.toLowerCase().includes(searchTerm) ||
    cs.products.some(p => p.toLowerCase().includes(searchTerm))
  );
}

/**
 * Get all industries
 */
export function getAllIndustries(): Industry[] {
  return Array.from(new Set(CASE_STUDIES.map(cs => cs.industry)));
}

/**
 * Get all products used across case studies
 */
export function getAllProducts(): VercelProduct[] {
  const products = new Set<VercelProduct>();
  CASE_STUDIES.forEach(cs => {
    cs.products.forEach(p => products.add(p));
  });
  return Array.from(products);
}

/**
 * Format case study for AI context (concise format)
 */
export function formatCaseStudyForAI(cs: CaseStudy): string {
  let result = `${cs.company} (${cs.industry}): ${cs.description}`;

  if (cs.metrics && cs.metrics.length > 0) {
    const metricsStr = cs.metrics.map(m => `${m.value} ${m.description}`).join(', ');
    result += ` Results: ${metricsStr}.`;
  }

  result += ` Read more: ${cs.url}`;

  return result;
}

/**
 * Format multiple case studies for AI context
 */
export function formatCaseStudiesForAI(caseStudies: CaseStudy[]): string {
  if (caseStudies.length === 0) {
    return 'No relevant case studies found.';
  }

  return caseStudies.map(cs => `- ${formatCaseStudyForAI(cs)}`).join('\n');
}

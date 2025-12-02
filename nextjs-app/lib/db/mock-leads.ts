import type { Classification } from '../types';

export interface TestCase {
  label: string;
  expectedClassification: Classification;
  data: {
    name: string;
    email: string;
    company: string;
    message: string;
  };
}

export const testData = {
  support: {
    label: 'Support',
    expectedClassification: 'support' as const,
    data: {
      name: 'Sarah Johnson',
      email: 'sarah.johnson@notion.so',
      company: 'Notion',
      message: 'I need help resetting my password and accessing my account. I\'ve been locked out since yesterday and can\'t complete my work.',
    },
  },
  fake: {
    label: 'Fake company',
    expectedClassification: 'low-quality' as const,
    data: {
      name: 'John Doe',
      email: 'john.doe@nonexistentcompany123.com',
      company: 'NonExistent Corp',
      message: 'We are looking for enterprise deployment solutions for our growing team. We need help with scalability and performance optimization.',
    },
  },
  quality: {
    label: 'Person not found',
    expectedClassification: 'high-quality' as const,
    data: {
      name: 'Jennifer Martinez',
      email: 'jennifer.martinez@shopify.com',
      company: 'Shopify',
      message: 'Our company is looking to implement an enterprise solution for lead management across 500+ sales reps. We need advanced analytics, real-time sync, and custom workflow automation. Budget approved for $250K+ annually. Would like to schedule a demo for our executive team next week.',
    },
  },
  weak: {
    label: 'Standard',
    expectedClassification: 'low-quality' as const,
    data: {
      name: 'Bob Smith',
      email: 'bob@fakecorp12345.com',
      company: 'FakeCorp12345 Ltd',
      message: 'Just checking out your product. Maybe interested.',
    },
  },
  existing: {
    label: 'Existing',
    expectedClassification: 'existing' as const,
    data: {
      name: 'Jessica Brown',
      email: 'jessica.brown@stripe.com',
      company: 'Stripe',
      message: 'Hi, I\'m from the marketing team at Stripe. We\'d like to expand our usage to include our European offices. Can someone reach out to discuss pricing for an additional 300 seats?',
    },
  },
  appleQuality: {
    label: 'No LinkedIn',
    expectedClassification: 'high-quality' as const,
    data: {
      name: 'Sabih Khan',
      email: 'sabih.khan@apple.com',
      company: 'Apple',
      message: 'I\'m the COO at Apple and we\'re exploring enterprise deployment solutions for our internal teams. We need a scalable platform that can handle our global infrastructure requirements. Looking to discuss how your solution could integrate with our existing systems.',
    },
  },
  appleWeak: {
    label: 'Borderline',
    expectedClassification: 'low-quality' as const,
    data: {
      name: 'Matthias Mueller',
      email: 'matthias.mueller@apple.com',
      company: 'Apple',
      message: 'I\'m a researcher at Apple working on a small project. Just exploring some options for a personal side project.',
    },
  },
  appleAmbiguous: {
    label: 'Borderline',
    expectedClassification: 'high-quality' as const,
    data: {
      name: 'Michael Wu',
      email: 'michael.wu@apple.com',
      company: 'Apple',
      message: 'We\'re interested in learning more about your platform for potential use at Apple. Could you share some information about your enterprise capabilities?',
    },
  },
  mcmasterCarr: {
    label: 'Standard',
    expectedClassification: 'high-quality' as const,
    data: {
      name: 'Nina Shirole',
      email: 'nina.shirole@mcmaster.com',
      company: 'McMaster-Carr',
      message: 'We are a large company that has historically had our own data centers and we\'re looking into using Vercel to make it cheaper and faster to deploy our internal websites. We\'d like to discuss how Vercel could help us modernize our deployment infrastructure.',
    },
  },
  ambiguousSupport: {
    label: 'Borderline support',
    expectedClassification: 'high-quality' as const,
    data: {
      name: 'Tom Moor',
      email: 'tom@linear.app',
      company: 'Linear',
      message: 'We\'re having trouble with caching on our site - pages keep showing stale data after deployments. Is this a limitation of our plan or are we doing something wrong? We\'d consider upgrading to enterprise if that would fix it.',
    },
  },
} as const;

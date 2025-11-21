import type { LeadClassification } from './types';

export interface TestCase {
  label: string;
  expectedClassification: readonly LeadClassification[];
  data: {
    name: string;
    email: string;
    company: string;
    message: string;
  };
}

export const testData = {
  support: {
    label: 'Support Request',
    expectedClassification: ['support'] as const,
    data: {
      name: 'Sarah Johnson',
      email: 'sarah.johnson@notion.so',
      company: 'Notion',
      message: 'I need help resetting my password and accessing my account. I\'ve been locked out since yesterday and can\'t complete my work.',
    },
  },
  fake: {
    label: 'Fake Company',
    expectedClassification: ['low-value', 'uncertain'] as const,
    data: {
      name: 'John Doe',
      email: 'john.doe@nonexistentcompany123.com',
      company: 'NonExistent Corp',
      message: 'We are looking for enterprise deployment solutions for our growing team. We need help with scalability and performance optimization.',
    },
  },
  quality: {
    label: 'Quality Lead',
    expectedClassification: ['quality'] as const,
    data: {
      name: 'Jennifer Martinez',
      email: 'jennifer.martinez@shopify.com',
      company: 'Shopify',
      message: 'Our company is looking to implement an enterprise solution for lead management across 500+ sales reps. We need advanced analytics, real-time sync, and custom workflow automation. Budget approved for $250K+ annually. Would like to schedule a demo for our executive team next week.',
    },
  },
  weak: {
    label: 'Weak Lead',
    expectedClassification: ['low-value'] as const,
    data: {
      name: 'Bob Smith',
      email: 'bob@fakecorp12345.com',
      company: 'FakeCorp12345 Ltd',
      message: 'Just checking out your product. Maybe interested.',
    },
  },
  duplicate: {
    label: 'Duplicate Customer',
    expectedClassification: ['duplicate'] as const,
    data: {
      name: 'Jessica Brown',
      email: 'jessica.brown@stripe.com',
      company: 'Stripe',
      message: 'Hi, I\'m from the marketing team at Stripe. We\'d like to expand our usage to include our European offices. Can someone reach out to discuss pricing for an additional 300 seats?',
    },
  },
  appleQuality: {
    label: 'Apple COO (Quality)',
    expectedClassification: ['quality'] as const,
    data: {
      name: 'Sabih Khan',
      email: 'sabih.khan@apple.com',
      company: 'Apple',
      message: 'I\'m the COO at Apple and we\'re exploring enterprise deployment solutions for our internal teams. We need a scalable platform that can handle our global infrastructure requirements. Looking to discuss how your solution could integrate with our existing systems.',
    },
  },
  appleWeak: {
    label: 'Apple Researcher (Weak)',
    expectedClassification: ['low-value', 'uncertain'] as const,
    data: {
      name: 'Matthias Mueller',
      email: 'matthias.mueller@apple.com',
      company: 'Apple',
      message: 'I\'m a researcher at Apple working on a small project. Just exploring some options for a personal side project.',
    },
  },
  appleAmbiguous: {
    label: 'Apple Employee (Ambiguous)',
    expectedClassification: ['uncertain'] as const,
    data: {
      name: 'Michael Wu',
      email: 'michael.wu@apple.com',
      company: 'Apple',
      message: 'We\'re interested in learning more about your platform for potential use at Apple. Could you share some information about your enterprise capabilities?',
    },
  },
} as const;

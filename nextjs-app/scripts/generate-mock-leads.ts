/**
 * Generate Mock Processed Leads
 *
 * This script generates realistic mock lead data for demo purposes.
 * Run with: npx tsx scripts/generate-mock-leads.ts
 * Output: lib/db/generated-leads.json
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  Lead,
  Classification,
  LeadStatus,
  ClassificationEntry,
  BotResearch,
  Email,
  StatusInfo,
  Submission,
  BotRollout,
} from '../lib/types';

// =============================================================================
// DATA POOLS
// =============================================================================

const REAL_COMPANIES = [
  // Tech / Software
  { name: 'Shopify', domain: 'shopify.com', industry: 'ecommerce' },
  { name: 'Stripe', domain: 'stripe.com', industry: 'fintech' },
  { name: 'Linear', domain: 'linear.app', industry: 'software' },
  { name: 'Notion', domain: 'notion.so', industry: 'software' },
  { name: 'Figma', domain: 'figma.com', industry: 'design' },
  { name: 'Datadog', domain: 'datadoghq.com', industry: 'devops' },
  { name: 'Twilio', domain: 'twilio.com', industry: 'communications' },
  { name: 'Segment', domain: 'segment.com', industry: 'analytics' },
  { name: 'Airtable', domain: 'airtable.com', industry: 'software' },
  { name: 'Webflow', domain: 'webflow.com', industry: 'design' },
  { name: 'Loom', domain: 'loom.com', industry: 'software' },
  { name: 'Amplitude', domain: 'amplitude.com', industry: 'analytics' },
  { name: 'Retool', domain: 'retool.com', industry: 'software' },
  { name: 'Plaid', domain: 'plaid.com', industry: 'fintech' },
  { name: 'Algolia', domain: 'algolia.com', industry: 'search' },
  { name: 'PostHog', domain: 'posthog.com', industry: 'analytics' },
  { name: 'Supabase', domain: 'supabase.com', industry: 'database' },
  { name: 'PlanetScale', domain: 'planetscale.com', industry: 'database' },
  { name: 'Railway', domain: 'railway.app', industry: 'infrastructure' },
  { name: 'Render', domain: 'render.com', industry: 'infrastructure' },
  // Additional companies for variety
  { name: 'Vercel', domain: 'vercel.com', industry: 'infrastructure' },
  { name: 'Clerk', domain: 'clerk.com', industry: 'auth' },
  { name: 'Resend', domain: 'resend.com', industry: 'email' },
  { name: 'Neon', domain: 'neon.tech', industry: 'database' },
  { name: 'Upstash', domain: 'upstash.com', industry: 'database' },
  { name: 'Convex', domain: 'convex.dev', industry: 'database' },
  { name: 'Sanity', domain: 'sanity.io', industry: 'cms' },
  { name: 'Contentful', domain: 'contentful.com', industry: 'cms' },
  { name: 'Prismic', domain: 'prismic.io', industry: 'cms' },
  { name: 'Storyblok', domain: 'storyblok.com', industry: 'cms' },
  { name: 'Auth0', domain: 'auth0.com', industry: 'auth' },
  { name: 'LaunchDarkly', domain: 'launchdarkly.com', industry: 'devops' },
  { name: 'Split', domain: 'split.io', industry: 'devops' },
  { name: 'CircleCI', domain: 'circleci.com', industry: 'devops' },
  { name: 'Sentry', domain: 'sentry.io', industry: 'devops' },
  { name: 'LogRocket', domain: 'logrocket.com', industry: 'analytics' },
  { name: 'FullStory', domain: 'fullstory.com', industry: 'analytics' },
  { name: 'Mixpanel', domain: 'mixpanel.com', industry: 'analytics' },
  { name: 'Heap', domain: 'heap.io', industry: 'analytics' },
  { name: 'Braze', domain: 'braze.com', industry: 'marketing' },
  { name: 'Customer.io', domain: 'customer.io', industry: 'marketing' },
  { name: 'Intercom', domain: 'intercom.com', industry: 'support' },
  { name: 'Zendesk', domain: 'zendesk.com', industry: 'support' },
  { name: 'HubSpot', domain: 'hubspot.com', industry: 'crm' },
  { name: 'Salesforce', domain: 'salesforce.com', industry: 'crm' },
  { name: 'MongoDB', domain: 'mongodb.com', industry: 'database' },
  { name: 'Cockroach Labs', domain: 'cockroachlabs.com', industry: 'database' },
  { name: 'Hasura', domain: 'hasura.io', industry: 'database' },
  { name: 'Apollo GraphQL', domain: 'apollographql.com', industry: 'software' },
  { name: 'GitLab', domain: 'gitlab.com', industry: 'devops' },
];

const FAKE_COMPANIES = [
  { name: 'TechCorp Solutions', domain: 'techcorpsolutions.fake', industry: 'unknown' },
  { name: 'CloudScale Inc', domain: 'cloudscale-inc.fake', industry: 'unknown' },
  { name: 'FakeStartup Ltd', domain: 'fakestartup.fake', industry: 'unknown' },
  { name: 'DataDriven Co', domain: 'datadriven-co.fake', industry: 'unknown' },
  { name: 'NextGen Systems', domain: 'nextgensystems.fake', industry: 'unknown' },
  { name: 'Innovative Labs', domain: 'innovativelabs.fake', industry: 'unknown' },
  { name: 'Digital Dynamics', domain: 'digitaldynamics.fake', industry: 'unknown' },
  { name: 'Alpha Solutions', domain: 'alphasolutions.fake', industry: 'unknown' },
  { name: 'Quantum Leap Tech', domain: 'quantumleaptech.fake', industry: 'unknown' },
  { name: 'ByteWise Systems', domain: 'bytewisesystems.fake', industry: 'unknown' },
  { name: 'CodeCraft Studios', domain: 'codecraftstudios.fake', industry: 'unknown' },
  { name: 'Pixel Perfect LLC', domain: 'pixelperfect.fake', industry: 'unknown' },
  { name: 'SynergyTech', domain: 'synergytech.fake', industry: 'unknown' },
  { name: 'BlueSky Innovations', domain: 'blueskyinnovations.fake', industry: 'unknown' },
  { name: 'MetaFlow Inc', domain: 'metaflowinc.fake', industry: 'unknown' },
  { name: 'NovaSoft', domain: 'novasoft.fake', industry: 'unknown' },
];

const FIRST_NAMES = [
  'James', 'Sarah', 'Michael', 'Emily', 'David', 'Jessica', 'Chris', 'Amanda',
  'Ryan', 'Jennifer', 'Kevin', 'Rachel', 'Brian', 'Michelle', 'Jason', 'Laura',
  'Matt', 'Nicole', 'Dan', 'Samantha', 'Alex', 'Katie', 'Tom', 'Ashley',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Chen', 'Wang', 'Kim', 'Patel', 'Singh', 'Lee',
  'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris',
];

const SDR_NAMES = ['Ryan', 'Sarah', 'Michael', 'Jessica'];

// Message templates by classification type
const MESSAGE_TEMPLATES = {
  'high-quality': [
    "We're a {size} company looking to modernize our deployment infrastructure. Currently spending ${budget}+ annually on DevOps and want to evaluate Vercel for our {useCase}. Can we schedule a call?",
    "I'm the {title} at {company}. We're evaluating platforms for our next-gen architecture and Vercel is on our shortlist. We have {teamSize} engineers and need enterprise features. When can we talk?",
    "Our team has been using Next.js and we're ready to move to Vercel. We need a solution that can handle {traffic} monthly visitors with {requirement}. Looking to make a decision this quarter.",
    "We're migrating from {competitor} and need a modern deployment platform. Budget is approved for ${budget}+ annually. Can you help us understand Vercel's enterprise capabilities?",
    "Looking to consolidate our infrastructure on Vercel. We have {numSites} production sites and need {feature}. Want to discuss enterprise pricing.",
  ],
  'low-quality': [
    "Just checking out your product. Might be interested later.",
    "I'm a student working on a side project. Do you have free tier options?",
    "Exploring options for a personal blog. Not sure if this is right for me.",
    "Can you tell me more about what Vercel does? I found you on Google.",
    "Interested in learning more. We're a small team just getting started.",
  ],
  'support': [
    "I'm having issues with my deployment - getting a 500 error after the latest push. Can someone help?",
    "Our site is showing stale data even after deployments. I think it's a caching issue. Please help urgently.",
    "Need help understanding our bill. We're seeing unexpected charges and want clarification.",
    "Can't access my team's dashboard after a recent password reset. Getting locked out repeatedly.",
    "Our domain isn't resolving correctly. DNS seems misconfigured but I followed the docs.",
  ],
  'existing': [
    "Following up on my previous inquiry about enterprise features. Haven't heard back yet.",
    "We spoke last month about migrating to Vercel. Ready to proceed now. Please reconnect me with the sales team.",
    "I'm from {company} - we're an existing customer. Want to discuss upgrading our plan to include more seats.",
    "Reaching out again about the enterprise contract we discussed. Need to add 50 more developer seats.",
  ],
  // Reroute messages - these reflect the ORIGINAL classification that was disputed
  // customer-reroute: Lead was wrongly marked as support/existing, but they're NOT an existing customer
  'customer-reroute': [
    "Hi, I'm interested in evaluating Vercel for our company. We're building a new product and need a modern deployment platform. Can someone from sales reach out?",
    "We're a new company looking at Vercel for our infrastructure. I filled out the contact form but got forwarded to support - I think there was a mix-up. We want to discuss enterprise options.",
    "I work at {company} but we're not currently a Vercel customer. I'm reaching out to explore enterprise solutions for a new initiative. Would love to connect with sales.",
    "Our company is evaluating deployment platforms. I submitted an inquiry but was told I'm an existing customer - I'm not! Can you connect me with the right team?",
  ],
  // support-reroute: Support team received this but it's actually a sales opportunity
  'support-reroute': [
    "We're having some issues with our current hosting provider and are looking for alternatives. Heard good things about Vercel. While we need help migrating, we're also interested in enterprise features.",
    "Our site performance has been poor lately. We're considering switching to Vercel entirely. Can someone help us understand both the technical migration and pricing?",
    "I have questions about how Vercel handles {feature}. We're an existing customer on Pro but want to explore upgrading to Enterprise for our growing team.",
    "Need help optimizing our build times. Also wondering if Enterprise would give us better performance - can you connect me with both support and sales?",
  ],
  // sales-reroute: Sales received this but it's actually a support issue
  'sales-reroute': [
    "I'm the {title} at {company}. We've been on Enterprise for 6 months but having issues with our deployment pipeline. The builds keep failing with timeout errors.",
    "We upgraded to Enterprise last quarter. Now we're seeing intermittent 502 errors on our edge functions. This is affecting production. Need urgent help.",
    "Following up on our enterprise contract discussion - also, we're seeing weird caching behavior that started after our last deployment. Can you help with both?",
    "We're an enterprise customer and I want to discuss expanding our contract, but first we need help resolving some DNS propagation issues that are blocking us.",
  ],
};

const EMAIL_TEMPLATES = {
  'high-quality': {
    subject: "Re: Your inquiry about Vercel Enterprise",
    body: `WARNING MOCKED DATA. Use the Contact Sales Form to see a real email.`,
  },
  'low-quality': {
    subject: "Thanks for your interest in Vercel",
    body: `Hi {name},

Thanks for reaching out! Vercel is a platform for frontend developers, providing the speed and reliability they need to build great web experiences.

Here are some resources to help you get started:
- Our free tier: https://vercel.com/pricing
- Documentation: https://vercel.com/docs
- Templates: https://vercel.com/templates

Feel free to reach out if you have specific questions.

Best,
Vercel Team`,
  },
};

const RESEARCH_REPORT_TEMPLATES = [
  `## Company Research: {company}

### Overview
{company} is a {industry} company that provides {description}. They appear to be a {size} organization with {teamEstimate} employees.

### Web Presence
- Website: {domain}
- {webPresence}

### Market Position
{company} operates in the competitive {industry} space. {marketPosition}

### Fit Assessment
{fitAssessment}

### Recommendation
Based on the research, this lead should be classified as **{classification}** with **{confidence}%** confidence.`,

  `## Lead Analysis: {company}

### Company Profile
{company} ({domain}) operates in the {industry} sector. Estimated size: {teamEstimate} employees.

### Digital Footprint
{webPresence}

### Business Context
{marketPosition}

### Vercel Fit Score
{fitAssessment}

Classification: **{classification}** (Confidence: {confidence}%)`,

  `## Research Summary

**Company:** {company}
**Industry:** {industry}
**Size:** {size} ({teamEstimate} employees)
**Website:** {domain}

### Key Findings
{webPresence}

{marketPosition}

### Assessment
{fitAssessment}

**Recommended Classification:** {classification} ({confidence}% confidence)`,
];

const WEB_PRESENCE_OPTIONS = {
  positive: [
    "The company website is well-established with modern design and clear enterprise positioning",
    "Strong online presence with active engineering blog and open source contributions",
    "Professional website with detailed product documentation and case studies",
    "Active on social media with engaged developer community",
    "Well-designed marketing site built with modern frameworks (appears to use Next.js)",
  ],
  neutral: [
    "Basic company website with limited technical information",
    "Website appears functional but dated in design",
    "Minimal online presence beyond main company site",
    "LinkedIn company page exists but limited activity",
  ],
  negative: [
    "Unable to find company website at provided domain",
    "Website appears to be a placeholder or under construction",
    "Very limited online presence - could not verify company legitimacy",
    "Domain registration is recent, limited company history available",
  ],
};

const MARKET_POSITION_OPTIONS = {
  strong: [
    "The company has strong brand recognition in their segment with notable customers",
    "Well-funded startup with significant traction and growing market share",
    "Established player in their space with multi-year track record",
    "Recognized leader in their industry with speaking presence at major conferences",
  ],
  moderate: [
    "Growing company with moderate market presence",
    "Competing in a crowded space but showing differentiation",
    "Building momentum with recent product launches",
    "Steady growth trajectory with room for expansion",
  ],
  weak: [
    "Early-stage company with limited market presence",
    "Unclear market positioning and competitive differentiation",
    "Small player in a competitive market",
    "Limited information available about market position",
  ],
};

const FIT_ASSESSMENT_OPTIONS = {
  'high-quality': [
    "Strong fit for Vercel Enterprise. Clear need for modern deployment infrastructure with budget and timeline.",
    "Excellent prospect - established company with clear technical requirements and decision-making authority.",
    "High-value opportunity. Company profile matches ideal customer persona for Enterprise tier.",
    "Strong buying signals present. Recommend prioritizing for immediate sales follow-up.",
  ],
  'low-quality': [
    "Limited fit indicators. May be better suited for self-serve Pro tier.",
    "Early exploration phase - no clear budget or timeline. Nurture for future.",
    "Personal/hobby project indicators. Free tier likely sufficient for current needs.",
    "Weak enterprise signals. Generic inquiry without specific requirements.",
  ],
  'support': [
    "Existing customer with active account. Technical support request, not sales inquiry.",
    "Clear support ticket - customer experiencing issues that need resolution.",
    "Account in good standing with billing/technical questions. Route to support.",
  ],
  'existing': [
    "CRM match confirmed. Existing enterprise customer - route to account team.",
    "Previous relationship identified. Account manager should handle this inquiry.",
    "Returning customer inquiry. Connect with existing account representative.",
  ],
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomDateInRange(daysAgo: number): Date {
  const now = new Date();
  const msAgo = daysAgo * 24 * 60 * 60 * 1000;
  const randomOffset = Math.random() * msAgo;
  return new Date(now.getTime() - randomOffset);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function generateEmail(firstName: string, lastName: string, domain: string): string {
  const formats = [
    `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`,
    `${firstName.toLowerCase()}@${domain}`,
    `${firstName[0].toLowerCase()}${lastName.toLowerCase()}@${domain}`,
  ];
  return randomChoice(formats);
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

function generateConfidence(targetRange: 'low' | 'medium' | 'high'): number {
  switch (targetRange) {
    case 'low':
      return randomFloat(0.4, 0.6);
    case 'medium':
      return randomFloat(0.6, 0.8);
    case 'high':
      return randomFloat(0.8, 0.95);
  }
}

// =============================================================================
// LEAD GENERATORS
// =============================================================================

interface GeneratedLead extends Omit<Lead, 'id'> {
  id: string;
}

function generateSubmission(
  classification: Classification,
  company: { name: string; domain: string; industry: string }
): Submission {
  const firstName = randomChoice(FIRST_NAMES);
  const lastName = randomChoice(LAST_NAMES);

  const messagePool = MESSAGE_TEMPLATES[classification as keyof typeof MESSAGE_TEMPLATES]
    || MESSAGE_TEMPLATES['low-quality'];

  let message = randomChoice(messagePool);
  message = fillTemplate(message, {
    company: company.name,
    size: randomChoice(['mid-size', 'large', 'enterprise']),
    budget: randomChoice(['50K', '100K', '200K', '500K']),
    useCase: randomChoice(['web applications', 'e-commerce platform', 'marketing sites', 'internal tools']),
    title: randomChoice(['VP of Engineering', 'CTO', 'Head of Platform', 'Director of Engineering']),
    teamSize: randomChoice(['50+', '100+', '200+', '500+']),
    traffic: randomChoice(['1M+', '5M+', '10M+', '50M+']),
    requirement: randomChoice(['global CDN', 'zero-downtime deploys', 'preview environments', 'SSO integration']),
    competitor: randomChoice(['AWS', 'Netlify', 'Heroku', 'DigitalOcean']),
    numSites: randomChoice(['10+', '25+', '50+', '100+']),
    feature: randomChoice(['advanced analytics', 'custom domains', 'team management', 'priority support']),
  });

  // Add warning prefix to all mocked messages
  message = `WARNING MOCKED DATA. use the Contact Sales Form for complete features.\n\n${message}`;

  return {
    leadName: `${firstName} ${lastName}`,
    email: generateEmail(firstName, lastName, company.domain),
    company: company.name,
    message,
  };
}

function generateBotResearch(
  classification: Classification,
  company: { name: string; domain: string; industry: string },
  confidence: number
): BotResearch {
  const timestamp = new Date(); // Will be adjusted later

  const reasoningMap: Record<Classification, string[]> = {
    'high-quality': [
      'Strong enterprise signals: large team size mentioned, budget approved, clear technical requirements.',
      'Company research shows established business with significant web presence. Decision maker reaching out.',
      'Clear buying intent with specific requirements and timeline. Matches ideal customer profile.',
      'Senior title (VP/Director level) with explicit interest in Enterprise features and pricing.',
      'Mentions specific technical needs (SSO, preview environments, analytics) aligned with Enterprise tier.',
    ],
    'low-quality': [
      'Weak buying signals: vague requirements, no budget mentioned, appears to be early exploration.',
      'Company research inconclusive. Unable to verify business legitimacy. Generic inquiry.',
      'Personal/hobby project indicators. No enterprise needs expressed.',
      'Student or individual developer inquiry. Better suited for free/hobby tier.',
      'No company context provided. Appears to be casual browsing rather than active evaluation.',
    ],
    'support': [
      'Clear support request: describes specific technical issue with existing deployment.',
      'Customer language indicates existing relationship. Needs technical assistance not sales.',
      'Bug report / troubleshooting request. Should be routed to support team.',
      'Billing or account access issue. Support team can resolve directly.',
      'DNS/domain configuration problem. Technical support required.',
    ],
    'existing': [
      'CRM match found: existing customer record with active account.',
      'Email domain matches existing enterprise customer. Account team should handle.',
      'Previous conversation history found. Returning customer inquiry.',
      'Active subscription detected. Account manager should be notified.',
    ],
    'customer-reroute': ['Customer disputed previous classification via feedback form.'],
    'support-reroute': ['Support team flagged this as a sales opportunity.'],
    'sales-reroute': ['Sales team flagged this as needing support assistance.'],
  };

  // Determine which options to use based on classification
  const isHighQuality = classification === 'high-quality';
  const isLowQuality = classification === 'low-quality';

  const webPresenceType = isHighQuality ? 'positive' : (isLowQuality ? randomChoice(['neutral', 'negative'] as const) : 'positive');
  const marketPositionType = isHighQuality ? 'strong' : (isLowQuality ? randomChoice(['moderate', 'weak'] as const) : 'moderate');

  const fitAssessmentPool = FIT_ASSESSMENT_OPTIONS[classification as keyof typeof FIT_ASSESSMENT_OPTIONS]
    || FIT_ASSESSMENT_OPTIONS['low-quality'];

  const researchReport = fillTemplate(randomChoice(RESEARCH_REPORT_TEMPLATES), {
    company: company.name,
    industry: company.industry,
    description: `${company.industry} solutions`,
    size: randomChoice(['mid-size', 'large', 'enterprise']),
    teamEstimate: randomChoice(['50-100', '100-500', '500-1000', '1000+']),
    domain: company.domain,
    webPresence: randomChoice(WEB_PRESENCE_OPTIONS[webPresenceType]),
    marketPosition: randomChoice(MARKET_POSITION_OPTIONS[marketPositionType]),
    fitAssessment: randomChoice(fitAssessmentPool),
    classification,
    confidence: Math.round(confidence * 100).toString(),
  });

  return {
    timestamp,
    confidence,
    classification,
    reasoning: randomChoice(reasoningMap[classification] || reasoningMap['low-quality']),
    existingCustomer: classification === 'existing' || classification === 'support',
    crmRecordId: (classification === 'existing' || classification === 'support')
      ? `CRM-${randomInt(10000, 99999)}`
      : undefined,
    researchReport,
  };
}

function generateEmail_content(
  classification: Classification,
  submission: Submission,
  sdrName: string,
  wasEdited: boolean
): Email {
  const template = classification === 'high-quality'
    ? EMAIL_TEMPLATES['high-quality']
    : EMAIL_TEMPLATES['low-quality'];

  const body = fillTemplate(template.body, {
    name: submission.leadName.split(' ')[0],
    company: submission.company,
    feature: randomChoice(['global edge network', 'preview deployments', 'team collaboration', 'analytics']),
    sdr: sdrName,
  });

  const createdAt = new Date(); // Will be adjusted later
  const editedAt = wasEdited ? addMinutes(createdAt, randomInt(5, 120)) : createdAt;

  return {
    text: body,
    createdAt,
    editedAt,
    lastEditedBy: wasEdited ? sdrName : undefined,
  };
}

function generateClassificationHistory(
  botClassification: Classification,
  finalClassification: Classification,
  wasOverridden: boolean,
  confidence: number,
  appliedThreshold: number
): ClassificationEntry[] {
  const entries: ClassificationEntry[] = [];

  // If overridden, human entry comes first (newest)
  if (wasOverridden) {
    entries.push({
      author: 'human',
      classification: finalClassification,
      timestamp: new Date(), // Will be adjusted
    });
  }

  // Bot entry (original classification)
  entries.push({
    author: 'bot',
    classification: botClassification,
    timestamp: new Date(), // Will be adjusted
    needs_review: confidence < appliedThreshold,
    applied_threshold: appliedThreshold,
  });

  return entries;
}

// =============================================================================
// MAIN GENERATION LOGIC
// =============================================================================

interface LeadConfig {
  classification: Classification;
  status: LeadStatus;
  confidenceRange: 'low' | 'medium' | 'high';
  useRealCompany: boolean;
  wasOverridden: boolean;
  wasEditedEmail: boolean;
  sentBy: 'bot' | 'human' | null;
  isReroute?: boolean;
  originalClassification?: Classification;
}

function generateLead(config: LeadConfig, index: number): GeneratedLead {
  const id = `mock_lead_${String(index).padStart(3, '0')}`;

  // Pick company
  const company = config.useRealCompany
    ? randomChoice(REAL_COMPANIES)
    : randomChoice(FAKE_COMPANIES);

  // Generate base dates
  const receivedAt = randomDateInRange(90);
  const processingTime = randomInt(30, 300); // 30 seconds to 5 minutes
  const botTimestamp = addMinutes(receivedAt, processingTime / 60);

  // Generate confidence
  const confidence = generateConfidence(config.confidenceRange);
  const appliedThreshold = 0.75; // Standard threshold

  // Determine bot's classification (may differ from final if overridden)
  const botClassification = config.wasOverridden
    ? (config.originalClassification || randomChoice(['low-quality', 'support'] as Classification[]))
    : config.classification;

  // Generate submission
  const submission = generateSubmission(config.classification, company);

  // Generate bot research
  const botResearch = generateBotResearch(botClassification, company, confidence);
  botResearch.timestamp = botTimestamp;

  // Generate classification history
  const classifications = generateClassificationHistory(
    botClassification,
    config.classification,
    config.wasOverridden,
    confidence,
    appliedThreshold
  );

  // Adjust classification timestamps
  classifications.forEach((entry, i) => {
    if (entry.author === 'bot') {
      entry.timestamp = botTimestamp;
    } else {
      // Human classification happens after bot, before send
      entry.timestamp = addMinutes(botTimestamp, randomInt(5, 60));
    }
  });

  // Determine sent time and sender
  let sentAt: Date | null = null;
  let sentBy: string | null = null;

  if (config.status === 'done') {
    if (config.sentBy === 'bot') {
      // Bot auto-send: happens immediately after classification
      sentAt = addMinutes(botTimestamp, randomInt(1, 5));
      sentBy = 'bot';
    } else if (config.sentBy === 'human') {
      // Human send: happens after review (1 min to 24 hours)
      const humanReviewTime = config.wasOverridden
        ? (classifications[0].timestamp as Date)
        : botTimestamp;
      sentAt = addHours(humanReviewTime, randomFloat(0.02, 24));
      sentBy = randomChoice(SDR_NAMES);
    }
  }

  // Generate email for:
  // - Done leads that send emails (high-quality, low-quality)
  // - High-quality leads in review (to show the placeholder email)
  let email: Email | null = null;
  if (
    (config.status === 'done' && ['high-quality', 'low-quality'].includes(config.classification)) ||
    (config.status === 'review' && config.classification === 'high-quality')
  ) {
    const sdrName = sentBy === 'bot' ? randomChoice(SDR_NAMES) : (sentBy || randomChoice(SDR_NAMES));
    email = generateEmail_content(config.classification, submission, sdrName, config.wasEditedEmail);
    email.createdAt = botTimestamp;
    if (config.wasEditedEmail && sentAt) {
      email.editedAt = addMinutes(sentAt, -randomInt(5, 30));
    } else {
      email.editedAt = botTimestamp;
    }
  }

  // Generate status
  const status: StatusInfo = {
    status: config.status,
    received_at: receivedAt,
    sent_at: sentAt,
    sent_by: sentBy,
  };

  // Generate bot rollout
  const botRollout: BotRollout = {
    rollOut: randomFloat(0, 1),
    useBot: config.sentBy === 'bot',
  };

  // Build the lead
  const lead: GeneratedLead = {
    id,
    submission,
    bot_research: botResearch,
    bot_rollout: botRollout,
    email,
    status,
    classifications,
  };

  // Add edit note for reroutes (specific to reroute type)
  if (config.isReroute) {
    const rerouteNotes: Record<string, string[]> = {
      'customer-reroute': [
        "I'm not actually an existing customer - this is a new sales inquiry.",
        "We're not a current Vercel customer. Please route to sales team.",
        "Wrong classification - we've never used Vercel before. Looking to evaluate.",
        "Not an existing customer! We're a new prospect interested in Enterprise.",
      ],
      'support-reroute': [
        "This looks like a sales opportunity - they're asking about upgrading to Enterprise.",
        "Customer is interested in expanding their contract, not just support.",
        "Rerouting to sales - this is a potential upsell opportunity.",
        "Support issue resolved, but they want to discuss Enterprise features. Sales should follow up.",
      ],
      'sales-reroute': [
        "This is actually a support issue - they have a production problem that needs immediate help.",
        "Customer needs technical support, not sales. Rerouting to support team.",
        "Their Enterprise deployment is having issues. Support should handle this first.",
        "Production incident - please route to support for urgent assistance.",
      ],
    };
    lead.edit_note = randomChoice(rerouteNotes[config.classification] || rerouteNotes['customer-reroute']);
  }

  return lead;
}

function generateAllLeads(): GeneratedLead[] {
  const leads: GeneratedLead[] = [];
  let index = 1;

  // Helper to add leads
  const addLeads = (count: number, config: Partial<LeadConfig>) => {
    for (let i = 0; i < count; i++) {
      const fullConfig: LeadConfig = {
        classification: 'high-quality',
        status: 'done',
        confidenceRange: 'medium',
        useRealCompany: true,
        wasOverridden: false,
        wasEditedEmail: false,
        sentBy: 'human',
        ...config,
      };
      leads.push(generateLead(fullConfig, index++));
    }
  };

  // ==========================================================================
  // HIGH-QUALITY LEADS (~29)
  // ==========================================================================

  // Bot auto-sent high-quality (high confidence) - 11 leads
  addLeads(11, {
    classification: 'high-quality',
    status: 'done',
    confidenceRange: 'high',
    useRealCompany: true,
    sentBy: 'bot',
  });

  // Human reviewed & sent high-quality - 14 leads
  addLeads(9, {
    classification: 'high-quality',
    status: 'done',
    confidenceRange: 'medium',
    useRealCompany: true,
    sentBy: 'human',
  });

  addLeads(5, {
    classification: 'high-quality',
    status: 'done',
    confidenceRange: 'low',
    useRealCompany: true,
    sentBy: 'human',
  });

  // Human overrode bot (was low-quality, changed to high-quality) - 2 leads
  addLeads(2, {
    classification: 'high-quality',
    status: 'done',
    confidenceRange: 'medium',
    useRealCompany: true,
    sentBy: 'human',
    wasOverridden: true,
    originalClassification: 'low-quality',
  });

  // Human overrode bot (was support, changed to high-quality) - 1 lead
  // Bot thought existing customer needing help, but actually a new sales opportunity
  addLeads(1, {
    classification: 'high-quality',
    status: 'done',
    confidenceRange: 'medium',
    useRealCompany: true,
    sentBy: 'human',
    wasOverridden: true,
    originalClassification: 'support',
  });

  // Human overrode bot (was existing, changed to high-quality) - 1 lead
  // Bot thought existing customer, but different person at same company
  addLeads(1, {
    classification: 'high-quality',
    status: 'done',
    confidenceRange: 'medium',
    useRealCompany: true,
    sentBy: 'human',
    wasOverridden: true,
    originalClassification: 'existing',
  });

  // ==========================================================================
  // LOW-QUALITY LEADS (~23)
  // ==========================================================================

  // Bot auto-sent low-quality - 9 leads
  addLeads(9, {
    classification: 'low-quality',
    status: 'done',
    confidenceRange: 'high',
    useRealCompany: false,
    sentBy: 'bot',
  });

  // Human reviewed & sent low-quality - 11 leads
  addLeads(11, {
    classification: 'low-quality',
    status: 'done',
    confidenceRange: 'medium',
    useRealCompany: false,
    sentBy: 'human',
  });

  // Human overrode bot (was high-quality, changed to low-quality) - 2 leads
  // Bot was optimistic, human recognized weak signals
  addLeads(2, {
    classification: 'low-quality',
    status: 'done',
    confidenceRange: 'medium',
    useRealCompany: true,
    sentBy: 'human',
    wasOverridden: true,
    originalClassification: 'high-quality',
  });

  // Human overrode bot (was support, changed to low-quality) - 1 lead
  // Bot thought existing customer, but not a customer at all - just generic inquiry
  addLeads(1, {
    classification: 'low-quality',
    status: 'done',
    confidenceRange: 'medium',
    useRealCompany: false,
    sentBy: 'human',
    wasOverridden: true,
    originalClassification: 'support',
  });

  // ==========================================================================
  // SUPPORT LEADS (~18)
  // ==========================================================================

  // Auto-forwarded support - 11 leads
  addLeads(11, {
    classification: 'support',
    status: 'done',
    confidenceRange: 'high',
    useRealCompany: true,
    sentBy: 'bot',
  });

  // Human reviewed support - 5 leads
  addLeads(5, {
    classification: 'support',
    status: 'done',
    confidenceRange: 'medium',
    useRealCompany: true,
    sentBy: 'human',
  });

  // Human overrode bot (was high-quality, changed to support) - 2 leads
  // Bot thought sales opportunity, but actually existing customer with issue
  addLeads(2, {
    classification: 'support',
    status: 'done',
    confidenceRange: 'medium',
    useRealCompany: true,
    sentBy: 'human',
    wasOverridden: true,
    originalClassification: 'high-quality',
  });

  // ==========================================================================
  // EXISTING CUSTOMER LEADS (~14)
  // ==========================================================================

  // Auto-forwarded existing - 9 leads
  addLeads(9, {
    classification: 'existing',
    status: 'done',
    confidenceRange: 'high',
    useRealCompany: true,
    sentBy: 'bot',
  });

  // Human reviewed existing - 5 leads
  addLeads(5, {
    classification: 'existing',
    status: 'done',
    confidenceRange: 'medium',
    useRealCompany: true,
    sentBy: 'human',
  });

  // ==========================================================================
  // REROUTES (~9)
  // These have classification history showing original → reroute
  // ==========================================================================

  // Customer reroutes: Bot wrongly classified as support/existing, customer disputed
  addLeads(2, {
    classification: 'customer-reroute',
    status: 'done',
    confidenceRange: 'medium',
    useRealCompany: true,
    sentBy: 'human',
    isReroute: true,
    wasOverridden: true,
    originalClassification: 'support', // Bot thought they were existing customer needing support
  });
  addLeads(2, {
    classification: 'customer-reroute',
    status: 'done',
    confidenceRange: 'medium',
    useRealCompany: true,
    sentBy: 'human',
    isReroute: true,
    wasOverridden: true,
    originalClassification: 'existing', // Bot thought they were already in CRM
  });

  // Support team reroutes: Support received it but it's actually a sales opportunity
  addLeads(3, {
    classification: 'support-reroute',
    status: 'done',
    confidenceRange: 'medium',
    useRealCompany: true,
    sentBy: 'human',
    isReroute: true,
    wasOverridden: true,
    originalClassification: 'support', // Was forwarded to support
  });

  // Sales team reroutes: Sales received it but it's actually a support issue
  addLeads(2, {
    classification: 'sales-reroute',
    status: 'done',
    confidenceRange: 'medium',
    useRealCompany: true,
    sentBy: 'human',
    isReroute: true,
    wasOverridden: true,
    originalClassification: 'high-quality', // Was sent as high-quality sales lead
  });

  // ==========================================================================
  // LEADS IN REVIEW (~5)
  // ==========================================================================

  addLeads(2, {
    classification: 'high-quality',
    status: 'review',
    confidenceRange: 'medium',
    useRealCompany: true,
    sentBy: null,
  });

  addLeads(2, {
    classification: 'low-quality',
    status: 'review',
    confidenceRange: 'low',
    useRealCompany: false,
    sentBy: null,
  });

  addLeads(1, {
    classification: 'support',
    status: 'review',
    confidenceRange: 'medium',
    useRealCompany: true,
    sentBy: null,
  });

  // ==========================================================================
  // NOTE: No "classify" status leads with bot_research
  // ==========================================================================
  // The "classify" status is ONLY for rollout A/B comparison (when useAIClassification=false).
  // In that case, bot_research is stored but NOT applied - human classifies independently.
  // Low-confidence leads now go to "review" status, not "classify".
  // The review leads above already cover low-confidence scenarios.

  // ==========================================================================
  // EMAIL EDITS (add to some existing done leads)
  // ==========================================================================

  // Mark ~20% of done high-quality/low-quality leads as having edited emails
  leads.forEach((lead) => {
    if (
      lead.status.status === 'done' &&
      ['high-quality', 'low-quality'].includes(lead.classifications[0]?.classification) &&
      lead.email &&
      Math.random() < 0.2
    ) {
      lead.email.lastEditedBy = randomChoice(SDR_NAMES);
      lead.email.editedAt = addMinutes(lead.email.createdAt as Date, randomInt(5, 60));
    }
  });

  // ==========================================================================
  // MEETING BOOKINGS (add to some high-quality done leads)
  // ==========================================================================

  // ~30% of high-quality done leads result in meetings booked
  leads.forEach((lead) => {
    if (
      lead.status.status === 'done' &&
      lead.status.sent_at &&
      lead.classifications[0]?.classification === 'high-quality' &&
      Math.random() < 0.3
    ) {
      // Meeting booked 1-72 hours after email sent
      const sentAt = lead.status.sent_at as Date;
      const hoursToMeeting = randomFloat(1, 72);
      (lead as any).meeting_booked_at = addHours(sentAt, hoursToMeeting);
    }
  });

  return leads;
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  console.log('Generating mock leads...');

  const leads = generateAllLeads();

  // Convert dates to ISO strings for JSON
  const serializedLeads = leads.map((lead) => {
    const meetingBookedAt = (lead as any).meeting_booked_at as Date | undefined;
    return {
      ...lead,
      bot_research: lead.bot_research
        ? {
            ...lead.bot_research,
            timestamp: (lead.bot_research.timestamp as Date).toISOString(),
          }
        : null,
      email: lead.email
        ? {
            ...lead.email,
            createdAt: (lead.email.createdAt as Date).toISOString(),
            editedAt: (lead.email.editedAt as Date).toISOString(),
          }
        : null,
      status: {
        ...lead.status,
        received_at: (lead.status.received_at as Date).toISOString(),
        sent_at: lead.status.sent_at ? (lead.status.sent_at as Date).toISOString() : null,
      },
      classifications: lead.classifications.map((c) => ({
        ...c,
        timestamp: (c.timestamp as Date).toISOString(),
      })),
      meeting_booked_at: meetingBookedAt ? meetingBookedAt.toISOString() : undefined,
    };
  });

  const outputPath = path.join(__dirname, '../lib/db/generated-leads.json');
  fs.writeFileSync(outputPath, JSON.stringify(serializedLeads, null, 2));

  // Print summary
  const statusCounts: Record<string, number> = {};
  const classificationCounts: Record<string, number> = {};

  leads.forEach((lead) => {
    const status = lead.status.status;
    const classification = lead.classifications[0]?.classification || 'unclassified';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    classificationCounts[classification] = (classificationCounts[classification] || 0) + 1;
  });

  console.log(`\nGenerated ${leads.length} leads`);
  console.log(`\nBy Status:`);
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  console.log(`\nBy Classification:`);
  Object.entries(classificationCounts).forEach(([classification, count]) => {
    console.log(`  ${classification}: ${count}`);
  });
  console.log(`\nOutput: ${outputPath}`);
}

main();

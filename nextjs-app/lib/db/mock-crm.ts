/**
 * Mock Salesforce CRM Data
 *
 * This simulates existing customers in a CRM system.
 * Used to detect existing customer leads that should be routed to Account Team
 * instead of being treated as new leads.
 */

export interface SalesforceContact {
  id: string;
  name: string;
  email: string;
  company: string;
  accountTeam: string;
  accountTeamEmail: string;
  accountType: 'Enterprise' | 'Mid-Market' | 'SMB';
  annualValue: number;
  status: 'Active' | 'Churned' | 'At-Risk';
  joinedDate: string;
  notes: string;
}

/**
 * Mock CRM Database - 4 customers showing variety
 */
export const MOCK_CRM_CUSTOMERS: SalesforceContact[] = [
  {
    id: 'SF-001',
    name: 'Alex Thompson',
    email: 'alex.thompson@globaltech.com',
    company: 'GlobalTech Industries',
    accountTeam: 'Sarah Chen',
    accountTeamEmail: 'sarah.chen@vercel.com',
    accountType: 'Enterprise',
    annualValue: 480000,
    status: 'Active',
    joinedDate: '2023-01-15',
    notes: 'Enterprise customer with 1,200 seats. Using advanced analytics package. Renewal date: Jan 2026.',
  },
  {
    id: 'SF-002',
    name: 'Maria Rodriguez',
    email: 'maria@cloudstartup.io',
    company: 'CloudStartup',
    accountTeam: 'James Park',
    accountTeamEmail: 'james.park@vercel.com',
    accountType: 'Mid-Market',
    annualValue: 85000,
    status: 'Active',
    joinedDate: '2024-03-20',
    notes: 'Fast-growing SaaS company. Currently using Professional plan with 75 users. Interested in API integrations.',
  },
  {
    id: 'SF-003',
    name: 'David Kim',
    email: 'david@designco.com',
    company: 'DesignCo',
    accountTeam: 'Michelle Wong',
    accountTeamEmail: 'michelle.wong@vercel.com',
    accountType: 'SMB',
    annualValue: 12000,
    status: 'At-Risk',
    joinedDate: '2023-08-10',
    notes: 'Small design agency with 8 users. Low engagement last 3 months. AE following up on usage.',
  },
  {
    id: 'SF-004',
    name: 'Jessica Brown',
    email: 'jessica.brown@stripe.com',
    company: 'Stripe',
    accountTeam: 'Robert Martinez',
    accountTeamEmail: 'robert.martinez@vercel.com',
    accountType: 'Enterprise',
    annualValue: 650000,
    status: 'Active',
    joinedDate: '2022-11-08',
    notes: 'Enterprise customer in payments space. Marketing team using Professional plan with 200 users. Expansion opportunity for European offices.',
  },
];

/**
 * Search for existing customer in mock CRM by email or company
 * Returns the matching contact if found, otherwise null
 */
export function salesforceSearch(email: string, company?: string): SalesforceContact | null {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedCompany = company?.toLowerCase().trim();

  // First, try exact email match
  const emailMatch = MOCK_CRM_CUSTOMERS.find(
    (contact) => contact.email.toLowerCase() === normalizedEmail
  );

  if (emailMatch) {
    return emailMatch;
  }

  // If no email match and company is provided, try company domain match
  if (normalizedCompany) {
    const companyMatch = MOCK_CRM_CUSTOMERS.find((contact) => {
      const contactCompany = contact.company.toLowerCase();
      return contactCompany === normalizedCompany ||
             contactCompany.includes(normalizedCompany) ||
             normalizedCompany.includes(contactCompany);
    });

    if (companyMatch) {
      return companyMatch;
    }
  }

  // Also check email domain against company
  // e.g., if email is john@globaltech.com, match against GlobalTech Industries
  const emailDomain = normalizedEmail.split('@')[1];
  if (emailDomain) {
    const domainMatch = MOCK_CRM_CUSTOMERS.find((contact) => {
      const contactEmailDomain = contact.email.toLowerCase().split('@')[1];
      const contactCompanySlug = contact.company.toLowerCase().replace(/[^a-z0-9]/g, '');
      const emailDomainSlug = emailDomain.replace(/[^a-z0-9]/g, '');

      // Match if email domains match OR email domain contains company name
      return contactEmailDomain === emailDomain ||
             emailDomainSlug.includes(contactCompanySlug);
    });

    if (domainMatch) {
      return domainMatch;
    }
  }

  return null;
}

/**
 * Get existing customer detection metadata for a lead
 */
export interface ExistingCustomerResult {
  isExisting: boolean;
  matchedContact?: SalesforceContact;
  matchReason?: string;
}

/**
 * Get a customer by ID
 */
export function getCustomerById(id: string): SalesforceContact | null {
  return MOCK_CRM_CUSTOMERS.find(contact => contact.id === id) || null;
}

export function detectExistingCustomer(email: string, company?: string): ExistingCustomerResult {
  const match = salesforceSearch(email, company);

  if (!match) {
    return { isExisting: false };
  }

  let matchReason = '';

  if (match.email.toLowerCase() === email.toLowerCase()) {
    matchReason = 'Exact email match';
  } else if (match.company.toLowerCase() === company?.toLowerCase()) {
    matchReason = 'Company name match';
  } else {
    matchReason = 'Email domain matches existing customer';
  }

  return {
    isExisting: true,
    matchedContact: match,
    matchReason,
  };
}

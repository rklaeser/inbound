#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import admin from 'firebase-admin';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
config({ path: join(__dirname, '..', '.env') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
  });
}

const db = admin.firestore();
const LEADS_COLLECTION = 'leads';
const CASE_STUDIES_COLLECTION = 'case_studies';
const CONFIGURATIONS_COLLECTION = 'configurations';

// Type definitions - matches nextjs-app/lib/types.ts

// Classification types - what kind of lead is this?
type Classification =
  | 'high-quality'      // Strong fit, gets personalized meeting offer email
  | 'low-quality'       // Not a fit or spam/nonsense, gets generic sales email
  | 'support'           // Existing customer needing help, forwarded to support
  | 'existing';         // Already a customer in CRM, forwarded to account team

// Terminal state - derived from status + classification when status = 'done'
type TerminalState =
  | 'sent_meeting_offer'      // high-quality lead, personalized email sent
  | 'sent_generic'            // low-quality lead, generic sales email sent
  | 'forwarded_support'       // support lead, forwarded to support team
  | 'forwarded_account_team'; // existing customer lead, forwarded to account team

// Reroute source - who initiated the reroute
type RerouteSource = 'customer' | 'support' | 'sales';

// Reroute entry - feedback from customer or internal team that the classification was wrong
interface Reroute {
  id: string;
  source: RerouteSource;
  reason?: string;
  originalClassification: Classification;
  previousTerminalState?: TerminalState;
  timestamp: admin.firestore.Timestamp;
}

// Status types - where is this lead in the workflow?
type LeadStatus = 'classify' | 'review' | 'done';

// Submission data - what the user submitted via the form
interface Submission {
  leadName: string;
  email: string;
  message: string;
  company: string;
}

// Bot research output - AI analysis of the lead
interface BotResearch {
  timestamp: admin.firestore.Timestamp;
  confidence: number;
  classification: Classification;
  reasoning: string;
  existingCustomer: boolean;
  crmRecordId?: string;
  researchReport?: string;
}

// Bot generated email text
interface BotText {
  highQualityText: string | null;
  lowQualityText: string | null;
}

// Bot rollout decision
interface BotRollout {
  rollOut: number;
  useBot: boolean;
}

// Human edits to email
interface HumanEdits {
  note: string | null;
  versions: Array<{
    text: string;
    timestamp: admin.firestore.Timestamp;
  }>;
}

// Lead status information
interface StatusInfo {
  status: LeadStatus;
  received_at: admin.firestore.Timestamp;
  sent_at: admin.firestore.Timestamp | null;
  sent_by: string | null;
}

// Classification entry (bot or human)
interface ClassificationEntry {
  author: 'human' | 'bot';
  classification: Classification;
  timestamp: admin.firestore.Timestamp;
  needs_review?: boolean;
  applied_threshold?: number;
}

// Matched case study from workflow research
interface MatchedCaseStudy {
  caseStudyId: string;
  company: string;
  industry: string;
  url: string;
  matchType: 'industry' | 'problem' | 'mentioned';
  matchReason: string;
  logoSvg?: string;
  featuredText?: string;
}

// Main Lead interface - matches actual Firestore structure
interface Lead {
  id: string;
  submission: Submission;
  bot_research: BotResearch | null;
  bot_text: BotText | null;
  bot_rollout: BotRollout | null;
  human_edits: HumanEdits | null;
  status: StatusInfo;
  classifications: ClassificationEntry[];
  metadata?: {
    isTestLead: boolean;
    testCase: string;
    expectedClassifications: Classification[];
  };
  matched_case_studies?: MatchedCaseStudy[];
  supportFeedback?: {
    markedSelfService: boolean;
    timestamp: admin.firestore.Timestamp;
  };
  reroute?: Reroute;
}

// Case Study types
type Industry =
  | 'Software'
  | 'AI'
  | 'Retail'
  | 'Business Services'
  | 'Finance & Insurance'
  | 'Media'
  | 'Healthcare'
  | 'Energy & Utilities';

type VercelProduct =
  | 'Next.js'
  | 'Preview Deployments'
  | 'Integrations'
  | 'ISR'
  | 'Edge Functions'
  | 'Image Optimization'
  | 'Analytics'
  | 'Vercel AI SDK';

interface CaseStudy {
  id: string;
  company: string;
  industry: Industry;
  products: VercelProduct[];
  url: string;
  logoSvg: string;
  featuredText: string;
  embedding?: number[];
  embedding_model?: string;
  embedding_generated_at?: admin.firestore.Timestamp;
  created_at?: admin.firestore.Timestamp;
  updated_at?: admin.firestore.Timestamp;
}

// Helper function to format timestamp
function formatTimestamp(timestamp: admin.firestore.Timestamp | null | undefined): string | null {
  if (!timestamp) return null;
  return timestamp.toDate().toISOString();
}

// Helper function to get current classification from classifications array
function getCurrentClassification(lead: any): Classification | null {
  if (!lead.classifications || lead.classifications.length === 0) return null;
  return lead.classifications[0].classification;
}

// Helper function to get current confidence from classifications array
function getCurrentConfidence(lead: any): number | null {
  if (!lead.bot_research) return null;
  return lead.bot_research.confidence;
}

// Helper function to format lead for output
function formatLead(lead: any, includeFullDetails: boolean = false): any {
  const currentClassification = getCurrentClassification(lead);
  const currentConfidence = getCurrentConfidence(lead);

  const baseFields = {
    id: lead.id,
    // Submission data
    name: lead.submission?.leadName || null,
    email: lead.submission?.email || null,
    company: lead.submission?.company || null,
    // Status
    status: lead.status?.status || null,
    // Classification (from classifications array)
    classification: currentClassification,
    confidence: currentConfidence,
    // Timestamps
    received_at: formatTimestamp(lead.status?.received_at),
  };

  if (!includeFullDetails) {
    return baseFields;
  }

  return {
    ...baseFields,
    // Full submission
    message: lead.submission?.message || null,
    // Bot research
    bot_research: lead.bot_research ? {
      classification: lead.bot_research.classification,
      confidence: lead.bot_research.confidence,
      reasoning: lead.bot_research.reasoning,
      existingCustomer: lead.bot_research.existingCustomer,
      crmRecordId: lead.bot_research.crmRecordId || null,
      researchReport: lead.bot_research.researchReport || null,
      timestamp: formatTimestamp(lead.bot_research.timestamp),
    } : null,
    // Bot text
    bot_text: lead.bot_text ? {
      highQualityText: lead.bot_text.highQualityText,
      lowQualityText: lead.bot_text.lowQualityText,
    } : null,
    // Bot rollout
    bot_rollout: lead.bot_rollout ? {
      rollOut: lead.bot_rollout.rollOut,
      useBot: lead.bot_rollout.useBot,
    } : null,
    // Human edits
    human_edits: lead.human_edits ? {
      note: lead.human_edits.note,
      versions: lead.human_edits.versions?.map((v: any) => ({
        text: v.text,
        timestamp: formatTimestamp(v.timestamp),
      })) || [],
    } : null,
    // Full status info
    status_info: {
      status: lead.status?.status || null,
      received_at: formatTimestamp(lead.status?.received_at),
      sent_at: formatTimestamp(lead.status?.sent_at),
      sent_by: lead.status?.sent_by || null,
    },
    // Classification history
    classifications: lead.classifications?.map((c: any) => ({
      author: c.author,
      classification: c.classification,
      timestamp: formatTimestamp(c.timestamp),
      needs_review: c.needs_review || false,
      applied_threshold: c.applied_threshold || null,
    })) || [],
    // Matched case studies
    matched_case_studies: lead.matched_case_studies || [],
    // Test metadata
    metadata: lead.metadata || null,
    // Support feedback
    supportFeedback: lead.supportFeedback ? {
      markedSelfService: lead.supportFeedback.markedSelfService,
      timestamp: formatTimestamp(lead.supportFeedback.timestamp),
    } : null,
    // Reroute information
    reroute: lead.reroute ? {
      id: lead.reroute.id,
      source: lead.reroute.source,
      reason: lead.reroute.reason || null,
      originalClassification: lead.reroute.originalClassification,
      previousTerminalState: lead.reroute.previousTerminalState || null,
      timestamp: formatTimestamp(lead.reroute.timestamp),
    } : null,
  };
}

// Helper function to determine workflow status
function determineWorkflowStatus(lead: any): {
  current_step: string;
  is_complete: boolean;
  progress_percentage: number;
  next_action: string;
  classification: Classification | null;
} {
  const status = lead.status?.status;
  const currentClassification = getCurrentClassification(lead);

  // Map status to workflow steps
  // Status: 'classify' | 'review' | 'done'
  const statusMap: Record<string, { step: string; percentage: number; action: string }> = {
    'classify': { step: 'Classification', percentage: 50, action: 'Awaiting human classification' },
    'review': { step: 'Review', percentage: 75, action: 'Awaiting human review of AI classification' },
    'done': { step: 'Complete', percentage: 100, action: 'Action taken' },
  };

  const info = statusMap[status] || { step: 'Unknown', percentage: 0, action: 'Status unknown' };

  // Enhance action description based on classification for done status
  let nextAction = info.action;
  if (status === 'done' && currentClassification) {
    const actionMap: Record<Classification, string> = {
      'high-quality': 'Meeting offer email sent',
      'low-quality': 'Generic sales email sent',
      'support': 'Forwarded to support team',
      'existing': 'Forwarded to account team',
    };
    nextAction = actionMap[currentClassification] || info.action;
  }

  return {
    current_step: info.step,
    is_complete: status === 'done',
    progress_percentage: info.percentage,
    next_action: nextAction,
    classification: currentClassification,
  };
}

// Helper function to format case study for output
function formatCaseStudy(caseStudy: any, includeEmbedding: boolean = false): any {
  const baseFields = {
    id: caseStudy.id,
    company: caseStudy.company,
    industry: caseStudy.industry,
    products: caseStudy.products || [],
    url: caseStudy.url,
    logoSvg: caseStudy.logoSvg || null,
    featuredText: caseStudy.featuredText || null,
    created_at: formatTimestamp(caseStudy.created_at),
    updated_at: formatTimestamp(caseStudy.updated_at),
  };

  if (!includeEmbedding) {
    return {
      ...baseFields,
      has_embedding: !!(caseStudy.embedding && caseStudy.embedding.length > 0),
      embedding_model: caseStudy.embedding_model || null,
      embedding_generated_at: formatTimestamp(caseStudy.embedding_generated_at),
    };
  }

  return {
    ...baseFields,
    embedding: caseStudy.embedding || null,
    embedding_model: caseStudy.embedding_model || null,
    embedding_generated_at: formatTimestamp(caseStudy.embedding_generated_at),
    embedding_dimension: caseStudy.embedding ? caseStudy.embedding.length : 0,
  };
}

// Helper function to calculate cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Create MCP server
const server = new Server(
  {
    name: 'inbound-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_leads',
        description: 'List leads with optional filtering. Returns slim fields by default for token efficiency. Use full_details=true to get all fields including bot_research, bot_text, human_edits, and classification history.',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'Filter by workflow status',
              enum: ['classify', 'review', 'done'],
            },
            classification: {
              type: 'string',
              description: 'Filter by current classification type',
              enum: ['high-quality', 'low-quality', 'support', 'existing'],
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 20, max: 100)',
              default: 20,
            },
            offset: {
              type: 'number',
              description: 'Number of results to skip for pagination (default: 0)',
              default: 0,
            },
            order_by: {
              type: 'string',
              description: 'Field to order by (default: received_at)',
              enum: ['received_at', 'sent_at'],
              default: 'received_at',
            },
            order_direction: {
              type: 'string',
              description: 'Order direction (asc, desc) (default: desc)',
              enum: ['asc', 'desc'],
              default: 'desc',
            },
            full_details: {
              type: 'boolean',
              description: 'Include all fields (bot_research, bot_text, human_edits, classification history, matched_case_studies) instead of just summary',
              default: false,
            },
          },
        },
      },
      {
        name: 'get_lead',
        description: 'Get detailed information about a specific lead by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The lead ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'get_workflow_status',
        description: 'Get the current workflow status and progress for a lead',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The lead ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'list_case_study_urls',
        description: 'List case study IDs, company names, and URLs only. Token-efficient alternative to list_case_studies.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_case_studies',
        description: 'List case studies with optional filtering by industry or product',
        inputSchema: {
          type: 'object',
          properties: {
            industry: {
              type: 'string',
              description: 'Filter by industry (Software, AI, Retail, Business Services, Finance & Insurance, Media, Healthcare, Energy & Utilities)',
            },
            product: {
              type: 'string',
              description: 'Filter by Vercel product (Next.js, Preview Deployments, Integrations, ISR, Edge Functions, Image Optimization, Analytics, Vercel AI SDK)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 20, max: 100)',
              default: 20,
            },
            offset: {
              type: 'number',
              description: 'Number of results to skip for pagination (default: 0)',
              default: 0,
            },
            include_embedding_info: {
              type: 'boolean',
              description: 'Include embedding metadata (default: false)',
              default: false,
            },
          },
        },
      },
      {
        name: 'get_case_study',
        description: 'Get detailed information about a specific case study by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The case study ID',
            },
            include_embedding: {
              type: 'boolean',
              description: 'Include the full embedding vector (default: false)',
              default: false,
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'search_case_studies',
        description: 'Search case studies by company name or keywords in description',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to match against company name, description, or products',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 10)',
              default: 10,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_case_study_embedding_info',
        description: 'Get embedding information and metadata for a case study',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The case study ID',
            },
            include_embedding_vector: {
              type: 'boolean',
              description: 'Include the full embedding vector (warning: large output)',
              default: false,
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'compare_case_studies',
        description: 'Compare embeddings between two case studies to see similarity score',
        inputSchema: {
          type: 'object',
          properties: {
            id1: {
              type: 'string',
              description: 'First case study ID',
            },
            id2: {
              type: 'string',
              description: 'Second case study ID',
            },
          },
          required: ['id1', 'id2'],
        },
      },
      {
        name: 'update_case_study',
        description: 'Update a case study with new data (e.g., full article text) and optionally regenerate embedding',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The case study ID',
            },
            full_article_text: {
              type: 'string',
              description: 'Full article text to store and use for embedding generation',
            },
            regenerate_embedding: {
              type: 'boolean',
              description: 'Whether to regenerate the embedding with the new text (default: true)',
              default: true,
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'list_configurations',
        description: 'List all configurations with optional filtering by status',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'Filter by status (draft, active, archived)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 20, max: 100)',
              default: 20,
            },
            offset: {
              type: 'number',
              description: 'Number of results to skip for pagination (default: 0)',
              default: 0,
            },
          },
        },
      },
      {
        name: 'get_configuration',
        description: 'Get detailed information about a specific configuration by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The configuration ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'delete_all_configurations',
        description: 'Delete ALL configurations from the database. Use with caution!',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'create_configuration',
        description: 'Create a new configuration with default settings and email template',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'Configuration status (draft or active) (default: active)',
              enum: ['draft', 'active'],
              default: 'active',
            },
          },
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_leads': {
        const {
          status,
          classification,
          limit = 20,
          offset = 0,
          order_by = 'received_at',
          order_direction = 'desc',
          full_details = false,
        } = args as {
          status?: string;
          classification?: string;
          limit?: number;
          offset?: number;
          order_by?: string;
          order_direction?: string;
          full_details?: boolean;
        };

        // Validate limit
        const validLimit = Math.min(Math.max(1, limit), 100);

        // Build query
        let query: admin.firestore.Query = db.collection(LEADS_COLLECTION);

        // Apply status filter (nested field: status.status)
        if (status) {
          query = query.where('status.status', '==', status);
        }

        // Apply ordering using nested field paths
        const orderField = order_by === 'sent_at' ? 'status.sent_at' : 'status.received_at';
        const direction = order_direction === 'asc' ? 'asc' : 'desc';
        query = query.orderBy(orderField, direction);

        // For classification filtering, we need to filter client-side since
        // Firestore can't directly query array[0].field
        // Fetch more if classification filter is applied to account for filtering
        const fetchLimit = classification ? validLimit * 3 : validLimit;
        query = query.offset(offset).limit(fetchLimit);

        // Execute query
        const snapshot = await query.get();

        let leads = snapshot.docs.map((doc) => {
          const data = doc.data();
          return { id: doc.id, ...data };
        });

        // Apply classification filter client-side if specified
        if (classification) {
          leads = leads.filter((lead: any) => {
            const currentClass = getCurrentClassification(lead);
            return currentClass === classification;
          });
          // Trim to requested limit after filtering
          leads = leads.slice(0, validLimit);
        }

        // Format leads for output
        const formattedLeads = leads.map((lead: any) => formatLead(lead, full_details));

        // Get total count (for pagination info)
        // Note: For classification filter, count is approximate since we filter client-side
        let totalQuery: admin.firestore.Query = db.collection(LEADS_COLLECTION);
        if (status) {
          totalQuery = totalQuery.where('status.status', '==', status);
        }
        const totalSnapshot = await totalQuery.count().get();
        const total = totalSnapshot.data().count;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                leads: formattedLeads,
                pagination: {
                  total,
                  limit: validLimit,
                  offset,
                  has_more: offset + validLimit < total,
                  note: classification ? 'Total count may not reflect classification filter (filtered client-side)' : undefined,
                },
                filters_applied: {
                  status: status || null,
                  classification: classification || null,
                },
              }, null, 2),
            },
          ],
        };
      }

      case 'get_lead': {
        const { id } = args as { id: string };

        if (!id) {
          throw new Error('Lead ID is required');
        }

        const doc = await db.collection(LEADS_COLLECTION).doc(id).get();

        if (!doc.exists) {
          throw new Error(`Lead with ID ${id} not found`);
        }

        const data = doc.data();
        const lead = formatLead({ id: doc.id, ...data }, true);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(lead, null, 2),
            },
          ],
        };
      }

      case 'get_workflow_status': {
        const { id } = args as { id: string };

        if (!id) {
          throw new Error('Lead ID is required');
        }

        const doc = await db.collection(LEADS_COLLECTION).doc(id).get();

        if (!doc.exists) {
          throw new Error(`Lead with ID ${id} not found`);
        }

        const data = doc.data();
        const workflowStatus = determineWorkflowStatus(data);
        const currentClassification = getCurrentClassification(data);

        const result = {
          lead_id: id,
          status: data!.status?.status || null,
          workflow: workflowStatus,
          timestamps: {
            received_at: formatTimestamp(data!.status?.received_at),
            sent_at: formatTimestamp(data!.status?.sent_at),
            bot_research_at: formatTimestamp(data!.bot_research?.timestamp),
          },
          classification: {
            current: currentClassification,
            confidence: data!.bot_research?.confidence || null,
            reasoning: data!.bot_research?.reasoning || null,
            existingCustomer: data!.bot_research?.existingCustomer || false,
            history_count: data!.classifications?.length || 0,
          },
          email_generated: !!(data!.bot_text?.highQualityText || data!.bot_text?.lowQualityText),
          email_edited: !!(data!.human_edits?.versions?.length > 0),
          sent_by: data!.status?.sent_by || null,
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'list_case_study_urls': {
        // Lightweight query - just get IDs, company names, and URLs
        const snapshot = await db.collection(CASE_STUDIES_COLLECTION)
          .orderBy('company', 'asc')
          .get();

        const caseStudyUrls = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            company: data.company,
            url: data.url,
          };
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                case_studies: caseStudyUrls,
                total: caseStudyUrls.length,
              }, null, 2),
            },
          ],
        };
      }

      case 'list_case_studies': {
        const {
          industry,
          product,
          limit = 20,
          offset = 0,
          include_embedding_info = false,
        } = args as {
          industry?: string;
          product?: string;
          limit?: number;
          offset?: number;
          include_embedding_info?: boolean;
        };

        // Validate limit
        const validLimit = Math.min(Math.max(1, limit), 100);

        // Build query
        let query: admin.firestore.Query = db.collection(CASE_STUDIES_COLLECTION);

        // Apply filters
        if (industry) {
          query = query.where('industry', '==', industry);
        }
        if (product) {
          query = query.where('products', 'array-contains', product);
        }

        // Apply ordering and pagination
        query = query.orderBy('company', 'asc').offset(offset).limit(validLimit);

        // Execute query
        const snapshot = await query.get();

        const caseStudies = snapshot.docs.map((doc) => {
          const data = doc.data();
          return formatCaseStudy({ id: doc.id, ...data }, false);
        });

        // Get total count
        let totalQuery: admin.firestore.Query = db.collection(CASE_STUDIES_COLLECTION);
        if (industry) {
          totalQuery = totalQuery.where('industry', '==', industry);
        }
        if (product) {
          totalQuery = totalQuery.where('products', 'array-contains', product);
        }
        const totalSnapshot = await totalQuery.count().get();
        const total = totalSnapshot.data().count;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                case_studies: caseStudies,
                pagination: {
                  total,
                  limit: validLimit,
                  offset,
                  has_more: offset + validLimit < total,
                },
                filters_applied: {
                  industry: industry || null,
                  product: product || null,
                },
              }, null, 2),
            },
          ],
        };
      }

      case 'get_case_study': {
        const { id, include_embedding = false } = args as {
          id: string;
          include_embedding?: boolean;
        };

        if (!id) {
          throw new Error('Case study ID is required');
        }

        const doc = await db.collection(CASE_STUDIES_COLLECTION).doc(id).get();

        if (!doc.exists) {
          throw new Error(`Case study with ID ${id} not found`);
        }

        const data = doc.data();
        const caseStudy = formatCaseStudy({ id: doc.id, ...data }, include_embedding);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(caseStudy, null, 2),
            },
          ],
        };
      }

      case 'search_case_studies': {
        const { query: searchQuery, limit = 10 } = args as {
          query: string;
          limit?: number;
        };

        if (!searchQuery) {
          throw new Error('Search query is required');
        }

        const validLimit = Math.min(Math.max(1, limit), 100);
        const searchTerm = searchQuery.toLowerCase();

        // Get all case studies (Firestore doesn't support full-text search)
        const snapshot = await db.collection(CASE_STUDIES_COLLECTION).get();

        const matchingCaseStudies = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            return { id: doc.id, ...data };
          })
          .filter((cs: any) => {
            // Search in company, featuredText, and products
            const companyMatch = cs.company?.toLowerCase().includes(searchTerm);
            const featuredTextMatch = cs.featuredText?.toLowerCase().includes(searchTerm);
            const productsMatch = cs.products?.some((p: string) =>
              p.toLowerCase().includes(searchTerm)
            );
            const industryMatch = cs.industry?.toLowerCase().includes(searchTerm);
            return companyMatch || featuredTextMatch || productsMatch || industryMatch;
          })
          .slice(0, validLimit)
          .map((cs) => formatCaseStudy(cs, false));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                case_studies: matchingCaseStudies,
                query: searchQuery,
                results_count: matchingCaseStudies.length,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_case_study_embedding_info': {
        const { id, include_embedding_vector = false } = args as {
          id: string;
          include_embedding_vector?: boolean;
        };

        if (!id) {
          throw new Error('Case study ID is required');
        }

        const doc = await db.collection(CASE_STUDIES_COLLECTION).doc(id).get();

        if (!doc.exists) {
          throw new Error(`Case study with ID ${id} not found`);
        }

        const data = doc.data();

        const embeddingInfo: any = {
          case_study_id: id,
          company: data!.company,
          has_embedding: !!(data!.embedding && data!.embedding.length > 0),
          embedding_model: data!.embedding_model || null,
          embedding_dimension: data!.embedding ? data!.embedding.length : 0,
          embedding_generated_at: formatTimestamp(data!.embedding_generated_at),
        };

        if (include_embedding_vector && data!.embedding) {
          embeddingInfo.embedding_vector = data!.embedding;
          embeddingInfo.embedding_vector_preview = data!.embedding.slice(0, 10);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(embeddingInfo, null, 2),
            },
          ],
        };
      }

      case 'compare_case_studies': {
        const { id1, id2 } = args as { id1: string; id2: string };

        if (!id1 || !id2) {
          throw new Error('Both case study IDs are required');
        }

        const doc1 = await db.collection(CASE_STUDIES_COLLECTION).doc(id1).get();
        const doc2 = await db.collection(CASE_STUDIES_COLLECTION).doc(id2).get();

        if (!doc1.exists) {
          throw new Error(`Case study with ID ${id1} not found`);
        }
        if (!doc2.exists) {
          throw new Error(`Case study with ID ${id2} not found`);
        }

        const data1 = doc1.data();
        const data2 = doc2.data();

        if (!data1!.embedding || !data2!.embedding) {
          throw new Error('Both case studies must have embeddings to compare');
        }

        const similarity = cosineSimilarity(data1!.embedding, data2!.embedding);

        const result = {
          case_study_1: {
            id: id1,
            company: data1!.company,
            industry: data1!.industry,
          },
          case_study_2: {
            id: id2,
            company: data2!.company,
            industry: data2!.industry,
          },
          similarity_score: similarity,
          interpretation: similarity > 0.9 ? 'Very similar' :
                          similarity > 0.8 ? 'Similar' :
                          similarity > 0.7 ? 'Moderately similar' :
                          similarity > 0.6 ? 'Somewhat similar' : 'Not very similar',
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'update_case_study': {
        const { id, full_article_text, regenerate_embedding = true } = args as {
          id: string;
          full_article_text?: string;
          regenerate_embedding?: boolean;
        };

        if (!id) {
          throw new Error('Case study ID is required');
        }

        const docRef = db.collection(CASE_STUDIES_COLLECTION).doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
          throw new Error(`Case study with ID ${id} not found`);
        }

        const data = doc.data();
        const updateData: any = {
          updated_at: admin.firestore.Timestamp.now(),
        };

        // Add full article text if provided
        if (full_article_text) {
          updateData.full_article_text = full_article_text;
        }

        // Regenerate embedding if requested
        if (regenerate_embedding && full_article_text) {
          console.error(`Generating embedding for ${data!.company} using full article text...`);

          const { embedding } = await embed({
            model: openai.embedding('text-embedding-3-small'),
            value: full_article_text,
          });

          updateData.embedding = embedding;
          updateData.embedding_model = 'text-embedding-3-small';
          updateData.embedding_generated_at = admin.firestore.Timestamp.now();
        }

        // Update the document
        await docRef.update(updateData);

        const result = {
          success: true,
          case_study_id: id,
          company: data!.company,
          updated_fields: Object.keys(updateData),
          embedding_regenerated: regenerate_embedding && !!full_article_text,
          full_article_length: full_article_text ? full_article_text.length : 0,
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'list_configurations': {
        const {
          status,
          limit = 20,
          offset = 0,
        } = args as {
          status?: string;
          limit?: number;
          offset?: number;
        };

        // Validate limit
        const validLimit = Math.min(Math.max(1, limit), 100);

        // Build query
        let query: admin.firestore.Query = db.collection(CONFIGURATIONS_COLLECTION);

        // Apply filter
        if (status) {
          query = query.where('status', '==', status);
        }

        // Apply ordering and pagination
        query = query.orderBy('created_at', 'desc').offset(offset).limit(validLimit);

        // Execute query
        const snapshot = await query.get();

        const configurations = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            version: data.version,
            status: data.status,
            activated_at: formatTimestamp(data.activated_at),
            created_at: formatTimestamp(data.created_at),
            archived_at: formatTimestamp(data.archived_at),
            emailTemplate: data.emailTemplate,
            settings: data.settings,
          };
        });

        // Get total count
        let totalQuery: admin.firestore.Query = db.collection(CONFIGURATIONS_COLLECTION);
        if (status) {
          totalQuery = totalQuery.where('status', '==', status);
        }
        const totalSnapshot = await totalQuery.count().get();
        const total = totalSnapshot.data().count;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                configurations,
                pagination: {
                  total,
                  limit: validLimit,
                  offset,
                  has_more: offset + validLimit < total,
                },
                filters_applied: {
                  status: status || null,
                },
              }, null, 2),
            },
          ],
        };
      }

      case 'get_configuration': {
        const { id } = args as { id: string };

        if (!id) {
          throw new Error('Configuration ID is required');
        }

        const doc = await db.collection(CONFIGURATIONS_COLLECTION).doc(id).get();

        if (!doc.exists) {
          throw new Error(`Configuration with ID ${id} not found`);
        }

        const data = doc.data();
        const configuration = {
          id: doc.id,
          name: data!.name,
          version: data!.version,
          status: data!.status,
          settings: data!.settings,
          emailTemplate: data!.emailTemplate,
          created_by: data!.created_by,
          activated_at: formatTimestamp(data!.activated_at),
          created_at: formatTimestamp(data!.created_at),
          archived_at: formatTimestamp(data!.archived_at),
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(configuration, null, 2),
            },
          ],
        };
      }

      case 'delete_all_configurations': {
        const snapshot = await db.collection(CONFIGURATIONS_COLLECTION).get();

        const deletePromises = snapshot.docs.map((doc) => doc.ref.delete());
        await Promise.all(deletePromises);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Deleted ${snapshot.docs.length} configuration(s)`,
                deleted_count: snapshot.docs.length,
              }, null, 2),
            },
          ],
        };
      }

      case 'create_configuration': {
        const { status = 'active' } = args as { status?: string };

        // Generate configuration ID
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let configId = 'cfg_';
        for (let i = 0; i < 12; i++) {
          configId += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // If creating as active, archive all existing active configurations
        if (status === 'active') {
          const activeConfigs = await db.collection(CONFIGURATIONS_COLLECTION)
            .where('status', '==', 'active')
            .get();

          const archivePromises = activeConfigs.docs.map((doc) =>
            doc.ref.update({
              status: 'archived',
              archived_at: admin.firestore.Timestamp.now(),
            })
          );
          await Promise.all(archivePromises);
        }

        // Create new configuration with default values
        const newConfig = {
          id: configId,
          name: configId,
          version: 1,
          status: status,
          settings: {
            autoRejectConfidenceThreshold: 0.9,
            qualityLeadConfidenceThreshold: 0.7,
          },
          emailTemplate: {
            subject: 'Hi from Vercel',
            greeting: 'Hi {firstName},',
            signOff: 'Best,',
            callToAction: "Let's schedule a quick 15-minute call to discuss how Vercel can help.",
          },
          created_by: 'system',
          activated_at: status === 'active' ? admin.firestore.Timestamp.now() : null,
          created_at: admin.firestore.Timestamp.now(),
          archived_at: null,
        };

        await db.collection(CONFIGURATIONS_COLLECTION).doc(configId).set(newConfig);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Created new ${status} configuration`,
                configuration: {
                  id: configId,
                  status: status,
                  version: 1,
                },
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: errorMessage }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Inbound MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

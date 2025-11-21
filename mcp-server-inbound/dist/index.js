#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
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
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();
const LEADS_COLLECTION = 'leads';
const CASE_STUDIES_COLLECTION = 'case_studies';
const CONFIGURATIONS_COLLECTION = 'configurations';
// Helper function to format timestamp
function formatTimestamp(timestamp) {
    if (!timestamp)
        return null;
    return timestamp.toDate().toISOString();
}
// Helper function to format lead for output
function formatLead(lead, includeFullDetails = false) {
    const baseFields = {
        id: lead.id,
        status: lead.status,
        classification: lead.classification,
        confidence_score: lead.confidence_score,
        name: lead.name,
        email: lead.email,
        company: lead.company,
        created_at: formatTimestamp(lead.created_at),
    };
    if (!includeFullDetails) {
        return baseFields;
    }
    return {
        ...baseFields,
        message: lead.message,
        reasoning: lead.reasoning,
        research_report: lead.research_report,
        person_job_title: lead.person_job_title,
        person_linkedin_url: lead.person_linkedin_url,
        generated_email_subject: lead.generated_email_subject,
        generated_email_body: lead.generated_email_body,
        final_email_subject: lead.final_email_subject,
        final_email_body: lead.final_email_body,
        edited: lead.edited || false,
        classified_at: formatTimestamp(lead.classified_at),
        sent_at: formatTimestamp(lead.sent_at),
        updated_at: formatTimestamp(lead.updated_at),
    };
}
// Helper function to determine workflow status
function determineWorkflowStatus(lead) {
    const status = lead.status;
    // Map status to workflow steps
    const statusMap = {
        'pending': { step: 'Submitted', percentage: 10, action: 'Starting research' },
        'researching': { step: 'Research', percentage: 25, action: 'AI gathering information' },
        'qualifying': { step: 'Qualification', percentage: 50, action: 'AI classifying lead' },
        'generating': { step: 'Email Generation', percentage: 75, action: 'AI drafting email' },
        'review': { step: 'Human Review', percentage: 90, action: 'Awaiting human approval' },
        'in_review': { step: 'Human Review', percentage: 90, action: 'Awaiting human approval' },
        'sent': { step: 'Complete', percentage: 100, action: 'Email sent' },
        'rejected': { step: 'Complete', percentage: 100, action: 'Lead rejected' },
        'forwarded': { step: 'Complete', percentage: 100, action: 'Forwarded to AE' },
        'error': { step: 'Error', percentage: 0, action: 'Workflow failed' },
    };
    const info = statusMap[status] || { step: 'Unknown', percentage: 0, action: 'Status unknown' };
    return {
        current_step: info.step,
        is_complete: ['sent', 'rejected', 'forwarded'].includes(status),
        is_error: status === 'error',
        progress_percentage: info.percentage,
        next_action: info.action,
    };
}
// Helper function to format case study for output
function formatCaseStudy(caseStudy, includeEmbedding = false) {
    const baseFields = {
        id: caseStudy.id,
        company: caseStudy.company,
        industry: caseStudy.industry,
        description: caseStudy.description,
        metrics: caseStudy.metrics || [],
        products: caseStudy.products || [],
        url: caseStudy.url,
        quote: caseStudy.quote || null,
        quotedPerson: caseStudy.quotedPerson || null,
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
function cosineSimilarity(a, b) {
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
const server = new Server({
    name: 'inbound-mcp-server',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'list_leads',
                description: 'List leads with optional filtering. Returns slim fields by default for token efficiency. Use full_details=true to get all fields.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        status: {
                            type: 'string',
                            description: 'Filter by status (researching, qualifying, generating, review, sent, rejected, error, forwarded)',
                        },
                        classification: {
                            type: 'string',
                            description: 'Filter by classification (quality, support, low-value, uncertain, dead, duplicate)',
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
                            description: 'Field to order by (created_at, updated_at) (default: created_at)',
                            enum: ['created_at', 'updated_at'],
                            default: 'created_at',
                        },
                        order_direction: {
                            type: 'string',
                            description: 'Order direction (asc, desc) (default: desc)',
                            enum: ['asc', 'desc'],
                            default: 'desc',
                        },
                        full_details: {
                            type: 'boolean',
                            description: 'Include all fields (message, reasoning, emails, etc.) instead of just summary',
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
                const { status, classification, limit = 20, offset = 0, order_by = 'created_at', order_direction = 'desc', full_details = false, } = args;
                // Validate limit
                const validLimit = Math.min(Math.max(1, limit), 100);
                // Build query
                let query = db.collection(LEADS_COLLECTION);
                // Apply filters
                if (status) {
                    query = query.where('status', '==', status);
                }
                if (classification) {
                    query = query.where('classification', '==', classification);
                }
                // Apply ordering
                const orderField = order_by === 'updated_at' ? 'updated_at' : 'created_at';
                const direction = order_direction === 'asc' ? 'asc' : 'desc';
                query = query.orderBy(orderField, direction);
                // Apply pagination
                query = query.offset(offset).limit(validLimit);
                // Execute query
                const snapshot = await query.get();
                const leads = snapshot.docs.map((doc) => {
                    const data = doc.data();
                    return formatLead({ id: doc.id, ...data }, full_details);
                });
                // Get total count (for pagination info)
                let totalQuery = db.collection(LEADS_COLLECTION);
                if (status) {
                    totalQuery = totalQuery.where('status', '==', status);
                }
                if (classification) {
                    totalQuery = totalQuery.where('classification', '==', classification);
                }
                const totalSnapshot = await totalQuery.count().get();
                const total = totalSnapshot.data().count;
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                leads,
                                pagination: {
                                    total,
                                    limit: validLimit,
                                    offset,
                                    has_more: offset + validLimit < total,
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
                const { id } = args;
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
                const { id } = args;
                if (!id) {
                    throw new Error('Lead ID is required');
                }
                const doc = await db.collection(LEADS_COLLECTION).doc(id).get();
                if (!doc.exists) {
                    throw new Error(`Lead with ID ${id} not found`);
                }
                const data = doc.data();
                const workflowStatus = determineWorkflowStatus(data);
                const result = {
                    lead_id: id,
                    status: data.status,
                    workflow: workflowStatus,
                    timestamps: {
                        created_at: formatTimestamp(data.created_at),
                        classified_at: formatTimestamp(data.classified_at),
                        sent_at: formatTimestamp(data.sent_at),
                        updated_at: formatTimestamp(data.updated_at),
                    },
                    classification: {
                        type: data.classification,
                        confidence: data.confidence_score,
                        reasoning: data.reasoning,
                    },
                    email_generated: !!(data.generated_email_subject || data.generated_email_body),
                    email_edited: data.edited || false,
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
            case 'list_case_studies': {
                const { industry, product, limit = 20, offset = 0, include_embedding_info = false, } = args;
                // Validate limit
                const validLimit = Math.min(Math.max(1, limit), 100);
                // Build query
                let query = db.collection(CASE_STUDIES_COLLECTION);
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
                let totalQuery = db.collection(CASE_STUDIES_COLLECTION);
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
                const { id, include_embedding = false } = args;
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
                const { query: searchQuery, limit = 10 } = args;
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
                    .filter((cs) => {
                    // Search in company, description, and products
                    const companyMatch = cs.company?.toLowerCase().includes(searchTerm);
                    const descriptionMatch = cs.description?.toLowerCase().includes(searchTerm);
                    const productsMatch = cs.products?.some((p) => p.toLowerCase().includes(searchTerm));
                    const industryMatch = cs.industry?.toLowerCase().includes(searchTerm);
                    return companyMatch || descriptionMatch || productsMatch || industryMatch;
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
                const { id, include_embedding_vector = false } = args;
                if (!id) {
                    throw new Error('Case study ID is required');
                }
                const doc = await db.collection(CASE_STUDIES_COLLECTION).doc(id).get();
                if (!doc.exists) {
                    throw new Error(`Case study with ID ${id} not found`);
                }
                const data = doc.data();
                const embeddingInfo = {
                    case_study_id: id,
                    company: data.company,
                    has_embedding: !!(data.embedding && data.embedding.length > 0),
                    embedding_model: data.embedding_model || null,
                    embedding_dimension: data.embedding ? data.embedding.length : 0,
                    embedding_generated_at: formatTimestamp(data.embedding_generated_at),
                };
                if (include_embedding_vector && data.embedding) {
                    embeddingInfo.embedding_vector = data.embedding;
                    embeddingInfo.embedding_vector_preview = data.embedding.slice(0, 10);
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
                const { id1, id2 } = args;
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
                if (!data1.embedding || !data2.embedding) {
                    throw new Error('Both case studies must have embeddings to compare');
                }
                const similarity = cosineSimilarity(data1.embedding, data2.embedding);
                const result = {
                    case_study_1: {
                        id: id1,
                        company: data1.company,
                        industry: data1.industry,
                    },
                    case_study_2: {
                        id: id2,
                        company: data2.company,
                        industry: data2.industry,
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
                const { id, full_article_text, regenerate_embedding = true } = args;
                if (!id) {
                    throw new Error('Case study ID is required');
                }
                const docRef = db.collection(CASE_STUDIES_COLLECTION).doc(id);
                const doc = await docRef.get();
                if (!doc.exists) {
                    throw new Error(`Case study with ID ${id} not found`);
                }
                const data = doc.data();
                const updateData = {
                    updated_at: admin.firestore.Timestamp.now(),
                };
                // Add full article text if provided
                if (full_article_text) {
                    updateData.full_article_text = full_article_text;
                }
                // Regenerate embedding if requested
                if (regenerate_embedding && full_article_text) {
                    console.error(`Generating embedding for ${data.company} using full article text...`);
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
                    company: data.company,
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
                const { status, limit = 20, offset = 0, } = args;
                // Validate limit
                const validLimit = Math.min(Math.max(1, limit), 100);
                // Build query
                let query = db.collection(CONFIGURATIONS_COLLECTION);
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
                let totalQuery = db.collection(CONFIGURATIONS_COLLECTION);
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
                const { id } = args;
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
                    name: data.name,
                    version: data.version,
                    status: data.status,
                    settings: data.settings,
                    emailTemplate: data.emailTemplate,
                    created_by: data.created_by,
                    activated_at: formatTimestamp(data.activated_at),
                    created_at: formatTimestamp(data.created_at),
                    archived_at: formatTimestamp(data.archived_at),
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
                const { status = 'active' } = args;
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
                    const archivePromises = activeConfigs.docs.map((doc) => doc.ref.update({
                        status: 'archived',
                        archived_at: admin.firestore.Timestamp.now(),
                    }));
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
    }
    catch (error) {
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

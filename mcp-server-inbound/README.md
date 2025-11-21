# Inbound Lead MCP Server

MCP server for debugging and managing the inbound lead qualification workflow.

## Features

### Phase 1: Core Debugging Tools

- **list_leads**: List leads with filtering and pagination
- **get_lead**: Get detailed information about a specific lead
- **get_workflow_status**: Check workflow execution status and progress

### Token Optimization

- **Slim Fields**: `list_leads` returns only essential fields by default (~80% token savings)
- **Full Details**: Use `full_details: true` to get all fields including messages, reasoning, and emails
- **Pagination**: Efficient handling of large datasets with offset/limit parameters

## Installation

```bash
cd mcp-server-inbound
npm install
npm run build
```

## Configuration

Add to `~/.config/claude-code/mcp_config.json`:

```json
{
  "mcpServers": {
    "inbound": {
      "command": "node",
      "args": ["/Users/reed/Code/inbound/mcp-server-inbound/dist/index.js"],
      "env": {}
    }
  }
}
```

## Environment Variables

The `.env` file should contain:

```bash
FIREBASE_PROJECT_ID=inbound-9f78d
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@inbound-9f78d.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Usage in Claude Code

After restarting Claude Code, the following tools will be available:

- `mcp__inbound__list_leads`
- `mcp__inbound__get_lead`
- `mcp__inbound__get_workflow_status`

## Tool Reference

### list_leads

List leads with optional filtering. Returns slim fields by default for token efficiency.

**Parameters:**
- `status` (optional): Filter by status (researching, qualifying, generating, review, sent, rejected, error, forwarded)
- `classification` (optional): Filter by classification (quality, support, low-value, uncertain, dead, duplicate)
- `limit` (optional): Maximum number of results (default: 20, max: 100)
- `offset` (optional): Number of results to skip for pagination (default: 0)
- `order_by` (optional): Field to order by - created_at or updated_at (default: created_at)
- `order_direction` (optional): Order direction - asc or desc (default: desc)
- `full_details` (optional): Include all fields instead of just summary (default: false)

**Example:**
```typescript
// List recent leads in review status
{
  "status": "review",
  "limit": 10
}

// List all quality leads with full details
{
  "classification": "quality",
  "full_details": true
}
```

**Slim Response (default):**
```json
{
  "leads": [
    {
      "id": "abc123",
      "status": "review",
      "classification": "quality",
      "confidence_score": 0.85,
      "name": "John Doe",
      "email": "john@example.com",
      "company": "Acme Corp",
      "created_at": "2024-11-17T12:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

### get_lead

Get detailed information about a specific lead by ID. Always returns full details.

**Parameters:**
- `id` (required): The lead ID

**Example:**
```typescript
{
  "id": "abc123"
}
```

**Response:**
```json
{
  "id": "abc123",
  "status": "review",
  "classification": "quality",
  "confidence_score": 0.85,
  "name": "John Doe",
  "email": "john@example.com",
  "company": "Acme Corp",
  "message": "I'm interested in your product...",
  "reasoning": "High-quality lead with clear purchase intent...",
  "generated_email_subject": "Re: Product Inquiry",
  "generated_email_body": "Hi John, Thank you for reaching out...",
  "final_email_subject": null,
  "final_email_body": null,
  "edited": false,
  "created_at": "2024-11-17T12:00:00.000Z",
  "classified_at": "2024-11-17T12:01:30.000Z",
  "sent_at": null,
  "updated_at": "2024-11-17T12:02:15.000Z"
}
```

### get_workflow_status

Get the current workflow status and progress for a lead.

**Parameters:**
- `id` (required): The lead ID

**Example:**
```typescript
{
  "id": "abc123"
}
```

**Response:**
```json
{
  "lead_id": "abc123",
  "status": "review",
  "workflow": {
    "current_step": "Human Review",
    "is_complete": false,
    "is_error": false,
    "progress_percentage": 90,
    "next_action": "Awaiting human approval"
  },
  "timestamps": {
    "created_at": "2024-11-17T12:00:00.000Z",
    "classified_at": "2024-11-17T12:01:30.000Z",
    "sent_at": null,
    "updated_at": "2024-11-17T12:02:15.000Z"
  },
  "classification": {
    "type": "quality",
    "confidence": 0.85,
    "reasoning": "High-quality lead with clear purchase intent..."
  },
  "email_generated": true,
  "email_edited": false
}
```

## Workflow Status Mapping

The workflow progresses through these stages:

1. **Submitted** (10%) - `pending` - Starting research
2. **Research** (25%) - `researching` - AI gathering information
3. **Qualification** (50%) - `qualifying` - AI classifying lead
4. **Email Generation** (75%) - `generating` - AI drafting email
5. **Human Review** (90%) - `review` - Awaiting human approval
6. **Complete** (100%) - `sent`, `rejected`, or `forwarded`

## Development

### Development Workflow

**Option 1: Manual Build**
1. Edit `src/index.ts`
2. Run `npm run build`
3. Reconnect MCP in Claude Code with `/mcp` command

**Option 2: Watch Mode (RECOMMENDED)**
1. Start watch mode: `npm run watch`
2. Edit `src/index.ts` → auto-compiles on save
3. Reconnect MCP in Claude Code with `/mcp` command after each change

### Scripts
- `npm run build` - Compile TypeScript once
- `npm run watch` - Auto-compile on file changes

### Troubleshooting

If MCP tools aren't working after code changes:
1. Check if TypeScript compiled: `ls -l dist/index.js`
2. Rebuild: `npm run build`
3. Reconnect: `/mcp` in Claude Code

## Common Use Cases

### Debugging Stuck Workflows

```typescript
// Find leads in error state
mcp__inbound__list_leads({ status: "error" })

// Check workflow progress for a specific lead
mcp__inbound__get_workflow_status({ id: "lead123" })
```

### Reviewing Classification Quality

```typescript
// Find uncertain classifications
mcp__inbound__list_leads({
  classification: "uncertain",
  full_details: true
})

// Review low-confidence leads
// (filter in code by confidence_score < 0.7)
```

### Monitoring Recent Activity

```typescript
// Get latest 20 leads
mcp__inbound__list_leads({
  limit: 20,
  order_by: "created_at",
  order_direction: "desc"
})
```

### Finding Leads Needing Attention

```typescript
// Leads waiting for human review
mcp__inbound__list_leads({ status: "review" })

// Quality leads that have been sent
mcp__inbound__list_leads({
  status: "sent",
  classification: "quality"
})
```

## Future Enhancements (Phase 2+)

- `create_test_lead` - Generate test leads for debugging
- `regenerate_email` - Re-run email generation
- `retry_workflow_step` - Retry failed workflow steps
- `get_lead_stats` - Summary statistics
- `find_edge_cases` - Find problematic leads

## License

MIT

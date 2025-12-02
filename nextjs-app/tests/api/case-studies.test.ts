import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockParams, sampleCaseStudy } from '../helpers';
import type { CaseStudy } from '@/lib/case-studies/types';

// Mock the case-studies module
vi.mock('@/lib/case-studies', () => ({
  getAllCaseStudies: vi.fn(),
  getCaseStudy: vi.fn(),
  createCaseStudy: vi.fn(),
  updateCaseStudy: vi.fn(),
  deleteCaseStudy: vi.fn(),
  validateCaseStudy: vi.fn(),
}));

import {
  getAllCaseStudies,
  getCaseStudy,
  createCaseStudy,
  updateCaseStudy,
  deleteCaseStudy,
  validateCaseStudy,
} from '@/lib/case-studies';

describe('GET /api/case-studies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all case studies without embeddings', async () => {
    const caseStudies: (CaseStudy & { embedding: number[] })[] = [
      { ...sampleCaseStudy, embedding: [0.1, 0.2, 0.3] },
      { ...sampleCaseStudy, id: 'cs-456', company: 'OtherCorp', embedding: [0.4, 0.5, 0.6] },
    ];
    vi.mocked(getAllCaseStudies).mockResolvedValue(caseStudies);

    const { GET } = await import('@/app/api/case-studies/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
    // Verify embeddings are stripped
    expect(data.data[0]).not.toHaveProperty('embedding');
  });

  it('returns empty array when no case studies exist', async () => {
    vi.mocked(getAllCaseStudies).mockResolvedValue([]);

    const { GET } = await import('@/app/api/case-studies/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(0);
  });

  it('handles errors gracefully', async () => {
    vi.mocked(getAllCaseStudies).mockRejectedValue(new Error('Database error'));

    const { GET } = await import('@/app/api/case-studies/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Failed to fetch');
  });
});

describe('POST /api/case-studies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates case study with valid data', async () => {
    vi.mocked(validateCaseStudy).mockReturnValue({ valid: true, errors: [] });
    vi.mocked(createCaseStudy).mockResolvedValue('new-cs-id');

    const newCaseStudy = {
      company: 'NewCorp',
      industry: 'Technology',
      products: ['Next.js'],
      url: 'https://example.com',
      logoSvg: '<svg></svg>',
      featuredText: 'Great results',
    };

    const { POST } = await import('@/app/api/case-studies/route');
    const request = createMockRequest('http://localhost/api/case-studies', {
      method: 'POST',
      body: newCaseStudy,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('new-cs-id');
    expect(createCaseStudy).toHaveBeenCalledWith(newCaseStudy);
  });

  it('rejects invalid case study data', async () => {
    vi.mocked(validateCaseStudy).mockReturnValue({
      valid: false,
      errors: ['Company name is required', 'URL is required'],
    });

    const { POST } = await import('@/app/api/case-studies/route');
    const request = createMockRequest('http://localhost/api/case-studies', {
      method: 'POST',
      body: { industry: 'Software' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.errors).toContain('Company name is required');
  });
});

describe('GET /api/case-studies/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns case study when it exists', async () => {
    vi.mocked(getCaseStudy).mockResolvedValue(sampleCaseStudy);

    const { GET } = await import('@/app/api/case-studies/[id]/route');
    const request = createMockRequest('http://localhost/api/case-studies/cs-123');
    const params = createMockParams({ id: 'cs-123' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('cs-123');
    expect(data.data.company).toBe('TechCorp');
  });

  it('returns 404 when case study does not exist', async () => {
    vi.mocked(getCaseStudy).mockResolvedValue(null);

    const { GET } = await import('@/app/api/case-studies/[id]/route');
    const request = createMockRequest('http://localhost/api/case-studies/nonexistent');
    const params = createMockParams({ id: 'nonexistent' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('not found');
  });
});

describe('PATCH /api/case-studies/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates case study with full data', async () => {
    vi.mocked(validateCaseStudy).mockReturnValue({ valid: true, errors: [] });
    vi.mocked(updateCaseStudy).mockResolvedValue(undefined);

    const updates = {
      company: 'UpdatedCorp',
      industry: 'Finance',
      products: ['Next.js', 'Vercel'],
      url: 'https://updated.com',
      logoSvg: '<svg>new</svg>',
      featuredText: 'Updated text',
    };

    const { PATCH } = await import('@/app/api/case-studies/[id]/route');
    const request = createMockRequest('http://localhost/api/case-studies/cs-123', {
      method: 'PATCH',
      body: updates,
    });
    const params = createMockParams({ id: 'cs-123' });

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(updateCaseStudy).toHaveBeenCalledWith('cs-123', updates);
  });

  it('allows logoSvg-only updates without full validation', async () => {
    vi.mocked(updateCaseStudy).mockResolvedValue(undefined);

    const { PATCH } = await import('@/app/api/case-studies/[id]/route');
    const request = createMockRequest('http://localhost/api/case-studies/cs-123', {
      method: 'PATCH',
      body: { logoSvg: '<svg>new logo</svg>' },
    });
    const params = createMockParams({ id: 'cs-123' });

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    // validateCaseStudy should not be called for logoSvg-only updates
    expect(validateCaseStudy).not.toHaveBeenCalled();
  });

  it('allows featuredText-only updates without full validation', async () => {
    vi.mocked(updateCaseStudy).mockResolvedValue(undefined);

    const { PATCH } = await import('@/app/api/case-studies/[id]/route');
    const request = createMockRequest('http://localhost/api/case-studies/cs-123', {
      method: 'PATCH',
      body: { featuredText: 'New featured text' },
    });
    const params = createMockParams({ id: 'cs-123' });

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(validateCaseStudy).not.toHaveBeenCalled();
  });

  it('rejects invalid full updates', async () => {
    vi.mocked(validateCaseStudy).mockReturnValue({
      valid: false,
      errors: ['URL must be a valid URL'],
    });

    const { PATCH } = await import('@/app/api/case-studies/[id]/route');
    const request = createMockRequest('http://localhost/api/case-studies/cs-123', {
      method: 'PATCH',
      body: { company: 'Test', url: 'not-a-url' },
    });
    const params = createMockParams({ id: 'cs-123' });

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });
});

describe('DELETE /api/case-studies/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes case study successfully', async () => {
    vi.mocked(deleteCaseStudy).mockResolvedValue(undefined);

    const { DELETE } = await import('@/app/api/case-studies/[id]/route');
    const request = createMockRequest('http://localhost/api/case-studies/cs-123', {
      method: 'DELETE',
    });
    const params = createMockParams({ id: 'cs-123' });

    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('cs-123');
    expect(deleteCaseStudy).toHaveBeenCalledWith('cs-123');
  });

  it('handles delete errors', async () => {
    vi.mocked(deleteCaseStudy).mockRejectedValue(new Error('Delete failed'));

    const { DELETE } = await import('@/app/api/case-studies/[id]/route');
    const request = createMockRequest('http://localhost/api/case-studies/cs-123', {
      method: 'DELETE',
    });
    const params = createMockParams({ id: 'cs-123' });

    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
  });
});

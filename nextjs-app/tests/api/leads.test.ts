import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockParams, sampleLead } from '../helpers';

// Mock dependencies before importing route handlers
vi.mock('@/lib/db', () => ({
  adminDb: {
    collection: vi.fn(),
  },
  toMillis: (value: unknown) => {
    if (!value) return 0;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'object' && 'toDate' in value && typeof (value as any).toDate === 'function') {
      return (value as any).toDate().getTime();
    }
    if (typeof value === 'number') return value;
    return new Date(value as string).getTime();
  },
}));

vi.mock('@/lib/analytics-helpers', () => ({
  logEmailEditEvent: vi.fn().mockResolvedValue(undefined),
  logEmailApprovalEvent: vi.fn().mockResolvedValue(undefined),
  logLeadForwardedEvent: vi.fn().mockResolvedValue(undefined),
  logMeetingBookedEvent: vi.fn().mockResolvedValue(undefined),
  logReclassificationEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/workflow-services', () => ({
  generateEmailForLead: vi.fn().mockResolvedValue({ body: 'Generated email body' }),
}));

vi.mock('@/lib/email', () => ({
  extractFirstName: vi.fn().mockReturnValue('John'),
  assembleEmail: vi.fn().mockReturnValue('Full assembled email'),
}));

vi.mock('@/lib/configuration-helpers', () => ({
  getConfiguration: vi.fn().mockResolvedValue({
    sdr: { name: 'Jane Smith', email: 'jane@company.com', title: 'SDR' },
    email: { enabled: true, testMode: true, testEmail: 'test@example.com' },
    emailTemplates: {
      highQuality: { greeting: 'Hi', callToAction: 'Book', signOff: 'Best' },
      lowQuality: { subject: 'Thanks', body: 'Message received' },
    },
  }),
}));

vi.mock('@/lib/email/classification-emails', () => ({
  sendHighQualityEmail: vi.fn().mockResolvedValue({ success: true, sentContent: { subject: 'Test', html: '<p>Test</p>' } }),
  sendLowQualityEmail: vi.fn().mockResolvedValue({ success: true, sentContent: { subject: 'Test', html: '<p>Test</p>' } }),
  sendSupportEmail: vi.fn().mockResolvedValue({ success: true, sentContent: { subject: 'Test', html: '<p>Test</p>' } }),
  sendExistingEmail: vi.fn().mockResolvedValue({ success: true, sentContent: { subject: 'Test', html: '<p>Test</p>' } }),
}));

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    now: vi.fn().mockReturnValue({
      toDate: () => new Date(),
    }),
  },
}));

// Import the mocked adminDb
import { adminDb } from '@/lib/db';

describe('GET /api/leads/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when lead does not exist', async () => {
    const mockDocRef = {
      get: vi.fn().mockResolvedValue({
        exists: false,
        data: () => null,
      }),
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    const { GET } = await import('@/app/api/leads/[id]/route');
    const request = createMockRequest('http://localhost/api/leads/nonexistent');
    const params = createMockParams({ id: 'nonexistent' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('not found');
  });

  it('returns lead when it exists', async () => {
    const mockDocRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: 'lead-123',
        data: () => sampleLead,
      }),
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    const { GET } = await import('@/app/api/leads/[id]/route');
    const request = createMockRequest('http://localhost/api/leads/lead-123');
    const params = createMockParams({ id: 'lead-123' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.lead.id).toBe('lead-123');
  });
});

describe('PATCH /api/leads/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when lead does not exist', async () => {
    const mockDocRef = {
      get: vi.fn().mockResolvedValue({
        exists: false,
        data: () => null,
      }),
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    const { PATCH } = await import('@/app/api/leads/[id]/route');
    const request = createMockRequest('http://localhost/api/leads/nonexistent', {
      method: 'PATCH',
      body: { edit_note: 'Test note' },
    });
    const params = createMockParams({ id: 'nonexistent' });

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
  });

  it('updates lead with valid edit_note', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockDocRef = {
      get: vi.fn()
        .mockResolvedValueOnce({
          exists: true,
          id: 'lead-123',
          data: () => sampleLead,
        })
        .mockResolvedValueOnce({
          exists: true,
          id: 'lead-123',
          data: () => ({ ...sampleLead, edit_note: 'Updated note' }),
        }),
      update: mockUpdate,
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    const { PATCH } = await import('@/app/api/leads/[id]/route');
    const request = createMockRequest('http://localhost/api/leads/lead-123', {
      method: 'PATCH',
      body: { edit_note: 'Updated note' },
    });
    const params = createMockParams({ id: 'lead-123' });

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({ edit_note: 'Updated note' });
  });

  it('rejects unknown fields due to strict schema', async () => {
    const mockDocRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: 'lead-123',
        data: () => sampleLead,
      }),
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    const { PATCH } = await import('@/app/api/leads/[id]/route');
    const request = createMockRequest('http://localhost/api/leads/lead-123', {
      method: 'PATCH',
      body: { unknown_field: 'should fail' },
    });
    const params = createMockParams({ id: 'lead-123' });

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('updates matched_case_studies', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockDocRef = {
      get: vi.fn()
        .mockResolvedValueOnce({
          exists: true,
          id: 'lead-123',
          data: () => sampleLead,
        })
        .mockResolvedValueOnce({
          exists: true,
          id: 'lead-123',
          data: () => sampleLead,
        }),
      update: mockUpdate,
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    const caseStudies = [{
      caseStudyId: 'cs-1',
      company: 'TechCorp',
      industry: 'Software',
      url: 'https://example.com',
      matchType: 'industry' as const,
      matchReason: 'Same industry',
    }];

    const { PATCH } = await import('@/app/api/leads/[id]/route');
    const request = createMockRequest('http://localhost/api/leads/lead-123', {
      method: 'PATCH',
      body: { matched_case_studies: caseStudies },
    });
    const params = createMockParams({ id: 'lead-123' });

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({ matched_case_studies: caseStudies });
  });
});

describe('PATCH /api/leads/[id]/review/edit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when lead does not exist', async () => {
    const mockDocRef = {
      get: vi.fn().mockResolvedValue({
        exists: false,
        data: () => null,
      }),
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    const { PATCH } = await import('@/app/api/leads/[id]/review/edit/route');
    const request = createMockRequest('http://localhost/api/leads/nonexistent/review/edit', {
      method: 'PATCH',
      body: { email_text: 'New email' },
    });
    const params = createMockParams({ id: 'nonexistent' });

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
  });

  it('requires email_text field', async () => {
    const { PATCH } = await import('@/app/api/leads/[id]/review/edit/route');
    const request = createMockRequest('http://localhost/api/leads/lead-123/review/edit', {
      method: 'PATCH',
      body: {},
    });
    const params = createMockParams({ id: 'lead-123' });

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('updates email text successfully', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockDocRef = {
      get: vi.fn()
        .mockResolvedValueOnce({
          exists: true,
          id: 'lead-123',
          data: () => ({ ...sampleLead, email: { text: 'Original email' } }),
        })
        .mockResolvedValueOnce({
          exists: true,
          id: 'lead-123',
          data: () => ({ ...sampleLead, email: { text: 'Updated email' } }),
        }),
      update: mockUpdate,
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    const { PATCH } = await import('@/app/api/leads/[id]/review/edit/route');
    const request = createMockRequest('http://localhost/api/leads/lead-123/review/edit', {
      method: 'PATCH',
      body: { email_text: 'Updated email' },
    });
    const params = createMockParams({ id: 'lead-123' });

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe('POST /api/leads/[id]/classify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires classification field', async () => {
    const { POST } = await import('@/app/api/leads/[id]/classify/route');
    const request = createMockRequest('http://localhost/api/leads/lead-123/classify', {
      method: 'POST',
      body: {},
    });
    const params = createMockParams({ id: 'lead-123' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('required');
  });

  it('rejects invalid classification values', async () => {
    const { POST } = await import('@/app/api/leads/[id]/classify/route');
    const request = createMockRequest('http://localhost/api/leads/lead-123/classify', {
      method: 'POST',
      body: { classification: 'invalid-type' },
    });
    const params = createMockParams({ id: 'lead-123' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid');
  });

  it('returns 404 when lead does not exist', async () => {
    const mockDocRef = {
      get: vi.fn().mockResolvedValue({
        exists: false,
        data: () => null,
      }),
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    const { POST } = await import('@/app/api/leads/[id]/classify/route');
    const request = createMockRequest('http://localhost/api/leads/nonexistent/classify', {
      method: 'POST',
      body: { classification: 'high-quality' },
    });
    const params = createMockParams({ id: 'nonexistent' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
  });

  it('accepts valid classification: support', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockAdd = vi.fn().mockResolvedValue({ id: 'event-1' });
    const mockDocRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: 'lead-123',
        data: () => sampleLead,
      }),
      update: mockUpdate,
    };
    vi.mocked(adminDb.collection).mockImplementation((name: string) => {
      if (name === 'leads') {
        return { doc: vi.fn().mockReturnValue(mockDocRef) } as any;
      }
      if (name === 'analytics_events') {
        return { add: mockAdd } as any;
      }
      return {} as any;
    });

    const { POST } = await import('@/app/api/leads/[id]/classify/route');
    const request = createMockRequest('http://localhost/api/leads/lead-123/classify', {
      method: 'POST',
      body: { classification: 'support' },
    });
    const params = createMockParams({ id: 'lead-123' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.classification).toBe('support');
  });
});

describe('POST /api/leads/[id]/review/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when lead does not exist', async () => {
    const mockDocRef = {
      get: vi.fn().mockResolvedValue({
        exists: false,
        data: () => null,
      }),
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    const { POST } = await import('@/app/api/leads/[id]/review/approve/route');
    const request = createMockRequest('http://localhost/api/leads/nonexistent/review/approve', {
      method: 'POST',
    });
    const params = createMockParams({ id: 'nonexistent' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
  });

  it('returns error when lead has no classification', async () => {
    const leadWithNoClassification = { ...sampleLead, classifications: [] };
    const mockDocRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: 'lead-123',
        data: () => leadWithNoClassification,
      }),
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    const { POST } = await import('@/app/api/leads/[id]/review/approve/route');
    const request = createMockRequest('http://localhost/api/leads/lead-123/review/approve', {
      method: 'POST',
    });
    const params = createMockParams({ id: 'lead-123' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('no classification');
  });

  it('approves lead with high-quality classification', async () => {
    const leadWithClassification = {
      ...sampleLead,
      classifications: [{ author: 'human', classification: 'high-quality', timestamp: new Date() }],
      email: { text: 'Email content' },
    };
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockDocRef = {
      get: vi.fn()
        .mockResolvedValueOnce({
          exists: true,
          id: 'lead-123',
          data: () => leadWithClassification,
        })
        .mockResolvedValueOnce({
          exists: true,
          id: 'lead-123',
          data: () => ({ ...leadWithClassification, status: { status: 'done' } }),
        }),
      update: mockUpdate,
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    const { POST } = await import('@/app/api/leads/[id]/review/approve/route');
    const request = createMockRequest('http://localhost/api/leads/lead-123/review/approve', {
      method: 'POST',
    });
    const params = createMockParams({ id: 'lead-123' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe('POST /api/leads/[id]/book-meeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when lead does not exist', async () => {
    const mockDocRef = {
      get: vi.fn().mockResolvedValue({
        exists: false,
        data: () => null,
      }),
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    const { POST } = await import('@/app/api/leads/[id]/book-meeting/route');
    const request = createMockRequest('http://localhost/api/leads/nonexistent/book-meeting', {
      method: 'POST',
    });
    const params = createMockParams({ id: 'nonexistent' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
  });

  it('books meeting successfully', async () => {
    // Lead must have status 'done' to book a meeting
    const doneLead = {
      ...sampleLead,
      status: { status: 'done' as const, received_at: new Date('2024-01-15T10:00:00Z'), sent_at: new Date('2024-01-15T10:05:00Z') },
    };
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockDocRef = {
      get: vi.fn()
        .mockResolvedValueOnce({
          exists: true,
          id: 'lead-123',
          data: () => doneLead,
        })
        .mockResolvedValueOnce({
          exists: true,
          id: 'lead-123',
          data: () => ({ ...doneLead, meeting_booked_at: new Date() }),
        }),
      update: mockUpdate,
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    const { POST } = await import('@/app/api/leads/[id]/book-meeting/route');
    const request = createMockRequest('http://localhost/api/leads/lead-123/book-meeting', {
      method: 'POST',
    });
    const params = createMockParams({ id: 'lead-123' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe('POST /api/leads/[id]/review/reclassify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when lead does not exist', async () => {
    const mockDocRef = {
      get: vi.fn().mockResolvedValue({
        exists: false,
        data: () => null,
      }),
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    const { POST } = await import('@/app/api/leads/[id]/review/reclassify/route');
    const request = createMockRequest('http://localhost/api/leads/nonexistent/review/reclassify', {
      method: 'POST',
      body: { new_classification: 'support' },
    });
    const params = createMockParams({ id: 'nonexistent' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
  });

  it('validates new_classification field', async () => {
    const { POST } = await import('@/app/api/leads/[id]/review/reclassify/route');
    const request = createMockRequest('http://localhost/api/leads/lead-123/review/reclassify', {
      method: 'POST',
      body: { new_classification: 'invalid' },
    });
    const params = createMockParams({ id: 'lead-123' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('reclassifies to low-quality and sends email', async () => {
    const leadWithClassification = {
      ...sampleLead,
      classifications: [{ author: 'human', classification: 'high-quality', timestamp: new Date() }],
    };
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockDocRef = {
      get: vi.fn()
        .mockResolvedValueOnce({
          exists: true,
          id: 'lead-123',
          data: () => leadWithClassification,
        })
        .mockResolvedValueOnce({
          exists: true,
          id: 'lead-123',
          data: () => ({ ...leadWithClassification, status: { status: 'done' } }),
        }),
      update: mockUpdate,
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    const { POST } = await import('@/app/api/leads/[id]/review/reclassify/route');
    const request = createMockRequest('http://localhost/api/leads/lead-123/review/reclassify', {
      method: 'POST',
      body: { new_classification: 'low-quality' },
    });
    const params = createMockParams({ id: 'lead-123' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('reclassifies to high-quality and generates email', async () => {
    const leadWithClassification = {
      ...sampleLead,
      classifications: [{ author: 'human', classification: 'low-quality', timestamp: new Date() }],
    };
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockDocRef = {
      get: vi.fn()
        .mockResolvedValueOnce({
          exists: true,
          id: 'lead-123',
          data: () => leadWithClassification,
        })
        .mockResolvedValueOnce({
          exists: true,
          id: 'lead-123',
          data: () => leadWithClassification,
        }),
      update: mockUpdate,
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    const { POST } = await import('@/app/api/leads/[id]/review/reclassify/route');
    const request = createMockRequest('http://localhost/api/leads/lead-123/review/reclassify', {
      method: 'POST',
      body: { new_classification: 'high-quality' },
    });
    const params = createMockParams({ id: 'lead-123' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('reclassifies to support and forwards', async () => {
    const leadWithClassification = {
      ...sampleLead,
      classifications: [{ author: 'human', classification: 'high-quality', timestamp: new Date() }],
    };
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockDocRef = {
      get: vi.fn()
        .mockResolvedValueOnce({
          exists: true,
          id: 'lead-123',
          data: () => leadWithClassification,
        })
        .mockResolvedValueOnce({
          exists: true,
          id: 'lead-123',
          data: () => ({ ...leadWithClassification, status: { status: 'done' } }),
        }),
      update: mockUpdate,
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    const { POST } = await import('@/app/api/leads/[id]/review/reclassify/route');
    const request = createMockRequest('http://localhost/api/leads/lead-123/review/reclassify', {
      method: 'POST',
      body: { new_classification: 'support' },
    });
    const params = createMockParams({ id: 'lead-123' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});

describe('PATCH /api/leads/[id]/case-studies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when lead does not exist', async () => {
    const mockDocRef = {
      get: vi.fn().mockResolvedValue({
        exists: false,
        data: () => null,
      }),
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    const { PATCH } = await import('@/app/api/leads/[id]/case-studies/route');
    const request = createMockRequest('http://localhost/api/leads/nonexistent/case-studies', {
      method: 'PATCH',
      body: { case_studies: [] },
    });
    const params = createMockParams({ id: 'nonexistent' });

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
  });

  it('validates case_studies schema', async () => {
    const { PATCH } = await import('@/app/api/leads/[id]/case-studies/route');
    const request = createMockRequest('http://localhost/api/leads/lead-123/case-studies', {
      method: 'PATCH',
      body: { case_studies: [{ invalid: 'data' }] },
    });
    const params = createMockParams({ id: 'lead-123' });

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('updates case studies successfully', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockDocRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: 'lead-123',
        data: () => ({ ...sampleLead, matched_case_studies: [] }),
      }),
      update: mockUpdate,
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    const newCaseStudies = [{
      caseStudyId: 'cs-1',
      company: 'TechCorp',
      industry: 'Software',
      url: 'https://example.com',
      matchType: 'industry' as const,
      matchReason: 'Same industry',
    }];

    const { PATCH } = await import('@/app/api/leads/[id]/case-studies/route');
    const request = createMockRequest('http://localhost/api/leads/lead-123/case-studies', {
      method: 'PATCH',
      body: { case_studies: newCaseStudies },
    });
    const params = createMockParams({ id: 'lead-123' });

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.matched_case_studies).toEqual(newCaseStudies);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('records change notes when adding case studies', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const existingCaseStudies = [{
      caseStudyId: 'cs-old',
      company: 'OldCorp',
      industry: 'Finance',
      url: 'https://old.com',
      matchType: 'industry' as const,
      matchReason: 'Old match',
    }];
    const mockDocRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: 'lead-123',
        data: () => ({ ...sampleLead, matched_case_studies: existingCaseStudies }),
      }),
      update: mockUpdate,
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    const newCaseStudies = [
      ...existingCaseStudies,
      {
        caseStudyId: 'cs-new',
        company: 'NewCorp',
        industry: 'Software',
        url: 'https://new.com',
        matchType: 'problem' as const,
        matchReason: 'New match',
      },
    ];

    const { PATCH } = await import('@/app/api/leads/[id]/case-studies/route');
    const request = createMockRequest('http://localhost/api/leads/lead-123/case-studies', {
      method: 'PATCH',
      body: { case_studies: newCaseStudies },
    });
    const params = createMockParams({ id: 'lead-123' });

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.change_note).toContain('Added');
    expect(data.change_note).toContain('NewCorp');
  });

  it('records change notes when removing case studies', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const existingCaseStudies = [
      {
        caseStudyId: 'cs-1',
        company: 'KeepCorp',
        industry: 'Software',
        url: 'https://keep.com',
        matchType: 'industry' as const,
        matchReason: 'Keep this',
      },
      {
        caseStudyId: 'cs-2',
        company: 'RemoveCorp',
        industry: 'Finance',
        url: 'https://remove.com',
        matchType: 'problem' as const,
        matchReason: 'Remove this',
      },
    ];
    const mockDocRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: 'lead-123',
        data: () => ({ ...sampleLead, matched_case_studies: existingCaseStudies }),
      }),
      update: mockUpdate,
    };
    vi.mocked(adminDb.collection).mockReturnValue({
      doc: vi.fn().mockReturnValue(mockDocRef),
    } as any);

    // Only keep the first case study
    const updatedCaseStudies = [existingCaseStudies[0]];

    const { PATCH } = await import('@/app/api/leads/[id]/case-studies/route');
    const request = createMockRequest('http://localhost/api/leads/lead-123/case-studies', {
      method: 'PATCH',
      body: { case_studies: updatedCaseStudies },
    });
    const params = createMockParams({ id: 'lead-123' });

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.change_note).toContain('Removed');
    expect(data.change_note).toContain('RemoveCorp');
  });
});

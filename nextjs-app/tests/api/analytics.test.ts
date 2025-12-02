import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

vi.mock('@/lib/types', () => ({
  getTerminalState: vi.fn().mockReturnValue(null),
  getCurrentClassification: vi.fn().mockReturnValue('high-quality'),
  wasReclassified: vi.fn().mockReturnValue(false),
}));

import { adminDb } from '@/lib/db';

describe('GET /api/analytics/overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no leads exist', async () => {
    const mockLeadsCollection = {
      get: vi.fn().mockResolvedValue({
        docs: [],
      }),
    };
    vi.mocked(adminDb.collection).mockReturnValue(mockLeadsCollection as any);

    const { GET } = await import('@/app/api/analytics/overview/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.analytics).toBeNull();
  });

  it('calculates basic analytics from leads', async () => {
    const mockLeads = [
      {
        id: 'lead-1',
        data: () => ({
          status: { status: 'done', received_at: new Date('2024-01-01') },
          classifications: [{ author: 'bot', classification: 'high-quality', timestamp: new Date() }],
          bot_research: { classification: 'high-quality', confidence: 0.9, timestamp: new Date() },
        }),
      },
      {
        id: 'lead-2',
        data: () => ({
          status: { status: 'review', received_at: new Date('2024-01-02') },
          classifications: [],
          bot_research: { classification: 'low-quality', confidence: 0.6, timestamp: new Date() },
        }),
      },
    ];

    const mockLeadsCollection = {
      get: vi.fn().mockResolvedValue({
        docs: mockLeads,
      }),
    };

    const mockAnalyticsCollection = {
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        empty: true,
        docs: [],
      }),
    };

    vi.mocked(adminDb.collection).mockImplementation((name: string) => {
      if (name === 'leads') return mockLeadsCollection as any;
      if (name === 'analytics_events') return mockAnalyticsCollection as any;
      return {} as any;
    });

    const { GET } = await import('@/app/api/analytics/overview/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.analytics).toBeDefined();
    expect(data.analytics.totalLeads).toBe(2);
    expect(data.analytics.leadsInReview).toBe(1);
    expect(data.analytics.leadsDone).toBe(1);
  });

  it('calculates human-AI comparison stats when available', async () => {
    const mockLeads = [
      {
        id: 'lead-1',
        data: () => ({
          status: { status: 'done', received_at: new Date('2024-01-01') },
          classifications: [{ author: 'human', classification: 'high-quality' }],
          bot_research: { classification: 'high-quality', confidence: 0.9 },
        }),
      },
    ];

    const mockComparisonEvents = [
      {
        data: () => ({
          event_type: 'human_ai_comparison',
          data: {
            ai_classification: 'high-quality',
            ai_confidence: 0.9,
            human_classification: 'high-quality',
            agreement: true,
            confidence_bucket: '90-100%',
            comparison_type: 'override',
          },
        }),
      },
      {
        data: () => ({
          event_type: 'human_ai_comparison',
          data: {
            ai_classification: 'low-quality',
            ai_confidence: 0.6,
            human_classification: 'support',
            agreement: false,
            confidence_bucket: '50-70%',
            comparison_type: 'blind',
          },
        }),
      },
    ];

    const mockLeadsCollection = {
      get: vi.fn().mockResolvedValue({ docs: mockLeads }),
    };

    const mockAnalyticsCollection = {
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        empty: false,
        docs: mockComparisonEvents,
      }),
    };

    vi.mocked(adminDb.collection).mockImplementation((name: string) => {
      if (name === 'leads') return mockLeadsCollection as any;
      if (name === 'analytics_events') return mockAnalyticsCollection as any;
      return {} as any;
    });

    const { GET } = await import('@/app/api/analytics/overview/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.analytics.humanAIComparison).toBeDefined();
    expect(data.analytics.humanAIComparison.totalComparisons).toBe(2);
    expect(data.analytics.humanAIComparison.agreements).toBe(1);
    expect(data.analytics.humanAIComparison.disagreements).toBe(1);
  });

  it('handles database errors gracefully', async () => {
    vi.mocked(adminDb.collection).mockReturnValue({
      get: vi.fn().mockRejectedValue(new Error('Database connection failed')),
    } as any);

    const { GET } = await import('@/app/api/analytics/overview/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Failed to fetch');
  });
});

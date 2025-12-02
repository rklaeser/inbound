import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the requirements data
vi.mock('@/lib/db/data-requirements', () => ({
  requirements: {
    title: 'System Requirements',
    sections: [
      { id: '1', title: 'Overview', content: 'System overview' },
      { id: '2', title: 'Classification', content: 'Lead classification rules' },
    ],
  },
}));

describe('GET /api/docs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns requirements documentation', async () => {
    const { GET } = await import('@/app/api/docs/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.title).toBe('System Requirements');
    expect(data.sections).toHaveLength(2);
  });

  it('includes all sections', async () => {
    const { GET } = await import('@/app/api/docs/route');
    const response = await GET();
    const data = await response.json();

    expect(data.sections[0].title).toBe('Overview');
    expect(data.sections[1].title).toBe('Classification');
  });
});

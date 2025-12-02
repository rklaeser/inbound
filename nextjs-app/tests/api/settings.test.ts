import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, sampleConfiguration } from '../helpers';

// Mock the configuration helpers
vi.mock('@/lib/configuration-helpers', () => ({
  getConfiguration: vi.fn(),
  updateConfiguration: vi.fn(),
  initializeConfiguration: vi.fn(),
  resetConfiguration: vi.fn(),
}));

import {
  getConfiguration,
  updateConfiguration,
  initializeConfiguration,
  resetConfiguration,
} from '@/lib/configuration-helpers';

describe('GET /api/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns current configuration', async () => {
    vi.mocked(getConfiguration).mockResolvedValue(sampleConfiguration as any);

    const { GET } = await import('@/app/api/settings/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.configuration).toBeDefined();
    expect(data.configuration.thresholds.highQuality).toBe(0.8);
  });

  it('initializes configuration when not found', async () => {
    // First call throws (not found), second call returns config
    vi.mocked(getConfiguration)
      .mockRejectedValueOnce(new Error('Not found'))
      .mockResolvedValueOnce(sampleConfiguration as any);
    vi.mocked(initializeConfiguration).mockResolvedValue(undefined);

    const { GET } = await import('@/app/api/settings/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(initializeConfiguration).toHaveBeenCalled();
  });

  it('handles errors gracefully', async () => {
    vi.mocked(getConfiguration).mockRejectedValue(new Error('Database error'));
    vi.mocked(initializeConfiguration).mockRejectedValue(new Error('Init failed'));

    const { GET } = await import('@/app/api/settings/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Failed to fetch');
  });
});

describe('PATCH /api/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates thresholds successfully', async () => {
    vi.mocked(updateConfiguration).mockResolvedValue(undefined);
    vi.mocked(getConfiguration).mockResolvedValue({
      ...sampleConfiguration,
      thresholds: { ...sampleConfiguration.thresholds, highQuality: 0.9 },
    } as any);

    const { PATCH } = await import('@/app/api/settings/route');
    const request = createMockRequest('http://localhost/api/settings', {
      method: 'PATCH',
      body: { thresholds: { highQuality: 0.9 } },
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(updateConfiguration).toHaveBeenCalled();
  });

  it('updates SDR info successfully', async () => {
    vi.mocked(updateConfiguration).mockResolvedValue(undefined);
    vi.mocked(getConfiguration).mockResolvedValue({
      ...sampleConfiguration,
      sdr: { ...sampleConfiguration.sdr, name: 'New SDR' },
    } as any);

    const { PATCH } = await import('@/app/api/settings/route');
    const request = createMockRequest('http://localhost/api/settings', {
      method: 'PATCH',
      body: { sdr: { name: 'New SDR' } },
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('updates rollout settings successfully', async () => {
    vi.mocked(updateConfiguration).mockResolvedValue(undefined);
    vi.mocked(getConfiguration).mockResolvedValue({
      ...sampleConfiguration,
      rollout: { enabled: true, percentage: 0.5 },
    } as any);

    const { PATCH } = await import('@/app/api/settings/route');
    const request = createMockRequest('http://localhost/api/settings', {
      method: 'PATCH',
      body: { rollout: { enabled: true, percentage: 0.5 } },
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('updates email settings successfully', async () => {
    vi.mocked(updateConfiguration).mockResolvedValue(undefined);
    vi.mocked(getConfiguration).mockResolvedValue({
      ...sampleConfiguration,
      email: { enabled: false, testMode: false, testEmail: 'new@test.com' },
    } as any);

    const { PATCH } = await import('@/app/api/settings/route');
    const request = createMockRequest('http://localhost/api/settings', {
      method: 'PATCH',
      body: { email: { enabled: false } },
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('rejects invalid threshold values', async () => {
    const { PATCH } = await import('@/app/api/settings/route');
    const request = createMockRequest('http://localhost/api/settings', {
      method: 'PATCH',
      body: { thresholds: { highQuality: 1.5 } }, // Invalid: > 1
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('rejects invalid email format', async () => {
    const { PATCH } = await import('@/app/api/settings/route');
    const request = createMockRequest('http://localhost/api/settings', {
      method: 'PATCH',
      body: { sdr: { email: 'not-an-email' } },
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('uses x-user-email header for updatedBy', async () => {
    vi.mocked(updateConfiguration).mockResolvedValue(undefined);
    vi.mocked(getConfiguration).mockResolvedValue(sampleConfiguration as any);

    const { PATCH } = await import('@/app/api/settings/route');
    const request = createMockRequest('http://localhost/api/settings', {
      method: 'PATCH',
      body: { allowHighQualityAutoSend: true },
      headers: { 'x-user-email': 'admin@company.com' },
    });

    const response = await PATCH(request);

    expect(response.status).toBe(200);
    expect(updateConfiguration).toHaveBeenCalledWith(
      expect.any(Object),
      'admin@company.com'
    );
  });
});

describe('DELETE /api/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets configuration to defaults', async () => {
    vi.mocked(resetConfiguration).mockResolvedValue(undefined);
    vi.mocked(getConfiguration).mockResolvedValue(sampleConfiguration as any);

    const { DELETE } = await import('@/app/api/settings/route');
    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('reset');
    expect(resetConfiguration).toHaveBeenCalled();
  });

  it('handles reset errors', async () => {
    vi.mocked(resetConfiguration).mockRejectedValue(new Error('Reset failed'));

    const { DELETE } = await import('@/app/api/settings/route');
    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Failed to reset');
  });
});

import { vi } from 'vitest';

// Mock server-only module
vi.mock('server-only', () => ({}));

// Mock Firebase Admin
vi.mock('@/lib/db/admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

// Mock Firebase Storage
vi.mock('@/lib/db/storage', () => ({
  uploadCaseStudyLogo: vi.fn(),
  deleteCaseStudyLogo: vi.fn(),
}));

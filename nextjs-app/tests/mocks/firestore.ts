import { vi } from 'vitest';

/**
 * Mock Firestore document snapshot
 */
export function createMockDocSnapshot(id: string, data: Record<string, unknown> | null) {
  return {
    id,
    exists: data !== null,
    data: () => data,
    ref: {
      id,
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

/**
 * Mock Firestore query snapshot
 */
export function createMockQuerySnapshot(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    empty: docs.length === 0,
    docs: docs.map((doc) => createMockDocSnapshot(doc.id, doc.data)),
    forEach: (callback: (doc: ReturnType<typeof createMockDocSnapshot>) => void) => {
      docs.forEach((doc) => callback(createMockDocSnapshot(doc.id, doc.data)));
    },
    size: docs.length,
  };
}

/**
 * Mock Firestore document reference
 */
export function createMockDocRef(id: string, data: Record<string, unknown> | null = null) {
  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockResolvedValue(undefined);
  const mockGet = vi.fn().mockResolvedValue(createMockDocSnapshot(id, data));

  return {
    id,
    get: mockGet,
    update: mockUpdate,
    delete: mockDelete,
    set: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Mock Firestore collection reference
 */
export function createMockCollectionRef(documents: Map<string, Record<string, unknown>>) {
  const mockAdd = vi.fn().mockImplementation(async (data) => {
    const id = `mock-id-${Date.now()}`;
    documents.set(id, data);
    return { id };
  });

  const mockDoc = vi.fn().mockImplementation((id: string) => {
    const data = documents.get(id) || null;
    return createMockDocRef(id, data);
  });

  const mockGet = vi.fn().mockImplementation(async () => {
    const docs = Array.from(documents.entries()).map(([id, data]) => ({
      id,
      data,
    }));
    return createMockQuerySnapshot(docs);
  });

  const mockWhere = vi.fn().mockReturnThis();

  return {
    add: mockAdd,
    doc: mockDoc,
    get: mockGet,
    where: mockWhere,
  };
}

/**
 * Create a complete mock adminDb
 */
export function createMockAdminDb() {
  const collections: Map<string, Map<string, Record<string, unknown>>> = new Map();

  const mockCollection = vi.fn().mockImplementation((name: string) => {
    if (!collections.has(name)) {
      collections.set(name, new Map());
    }
    return createMockCollectionRef(collections.get(name)!);
  });

  return {
    collection: mockCollection,
    _collections: collections,
  };
}

/**
 * Helper to set up mock data in a collection
 */
export function setMockCollectionData(
  adminDb: ReturnType<typeof createMockAdminDb>,
  collectionName: string,
  documents: Array<{ id: string; data: Record<string, unknown> }>
) {
  const collection = new Map<string, Record<string, unknown>>();
  documents.forEach(({ id, data }) => collection.set(id, data));
  adminDb._collections.set(collectionName, collection);
}

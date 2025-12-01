/**
 * Firestore serialization utilities for Next.js Server Components
 *
 * Converts Firestore Timestamps to ISO strings for JSON serialization
 */

/**
 * Serializes Firestore document data by converting all Timestamp fields to ISO strings.
 *
 * This handles Firebase Admin SDK Timestamp format: { _seconds: number, _nanoseconds: number }
 *
 * @param data - Raw Firestore document data
 * @returns Serialized data with Timestamps converted to ISO strings
 *
 * @example
 * const docData = docSnap.data();
 * const serialized = serializeFirestoreData({ id: docSnap.id, ...docData });
 */
export function serializeFirestoreData<T>(data: any): T {
  if (!data || typeof data !== 'object') {
    return data;
  }

  // Check if this is a Firebase Admin SDK Timestamp
  // Format: { _seconds: number, _nanoseconds: number }
  if ('_seconds' in data && '_nanoseconds' in data) {
    return new Date(data._seconds * 1000).toISOString() as T;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => serializeFirestoreData(item)) as T;
  }

  // Handle objects - recursively serialize all properties
  const serialized: any = {};
  for (const key in data) {
    serialized[key] = serializeFirestoreData(data[key]);
  }

  return serialized;
}

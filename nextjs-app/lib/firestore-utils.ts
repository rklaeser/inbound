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

  const serialized: any = { ...data };

  // Iterate over top-level properties
  for (const key in serialized) {
    const value = serialized[key];

    // Check if this is a Firebase Admin SDK Timestamp
    // Format: { _seconds: number, _nanoseconds: number }
    if (value && typeof value === 'object' && '_seconds' in value) {
      serialized[key] = new Date(value._seconds * 1000).toISOString();
    }
  }

  return serialized;
}

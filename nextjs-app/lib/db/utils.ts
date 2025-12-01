/**
 * Firestore utilities for Next.js Server Components
 *
 * - Converts Firestore Timestamps to ISO strings for JSON serialization
 * - Converts Firestore Timestamps to Date objects for runtime use
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Converts a Firestore Timestamp (or Date) to a JavaScript Date.
 *
 * Handles multiple formats:
 * - Firebase Admin SDK Timestamp: { _seconds, _nanoseconds } with toDate() method
 * - Firebase Client SDK Timestamp: { seconds, nanoseconds } with toDate() method
 * - JavaScript Date: returns as-is
 * - null/undefined: returns null
 *
 * @param value - Firestore Timestamp, Date, or null/undefined
 * @returns JavaScript Date or null
 *
 * @example
 * const receivedAt = toDate(lead.status.received_at);
 * const timeMs = receivedAt?.getTime() ?? 0;
 */
export function toDate(value: Date | Timestamp | { toDate(): Date } | null | undefined): Date | null {
  if (!value) return null;

  // Already a Date
  if (value instanceof Date) return value;

  // Firestore Timestamp with toDate() method
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }

  // Shouldn't reach here, but return null for safety
  return null;
}

/**
 * Gets the timestamp in milliseconds from a Firestore Timestamp or Date.
 *
 * @param value - Firestore Timestamp, Date, or null/undefined
 * @returns Milliseconds since epoch, or 0 if null
 */
export function toMillis(value: Date | Timestamp | { toDate(): Date } | null | undefined): number {
  const date = toDate(value);
  return date?.getTime() ?? 0;
}

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

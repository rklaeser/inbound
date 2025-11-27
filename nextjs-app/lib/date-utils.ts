import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

/**
 * Formats a date in Vercel style: relative time for last 24 hours, "Nov 13" otherwise
 */
export function formatHumanDate(date: Date | Timestamp | string | null | undefined): string {
  if (!date) return 'N/A';

  let jsDate: Date;
  if (date instanceof Date) {
    jsDate = date;
  } else if (typeof date === 'string') {
    jsDate = new Date(date);
  } else {
    jsDate = new Date(date.seconds * 1000);
  }

  const now = new Date();
  const diffMs = now.getTime() - jsDate.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  // Show relative time for dates within the last 24 hours
  if (diffMs >= 0 && diffMs < 24 * 60 * 60 * 1000) {
    if (diffMins < 1) {
      return 'just now';
    } else if (diffMins < 60) {
      return `${diffMins} min ago`;
    } else {
      return `${diffHours} hr ago`;
    }
  }

  return format(jsDate, 'MMM d');
}

/**
 * Formats a date with year: "Nov 13, 2024"
 */
export function formatHumanDateWithYear(date: Date | Timestamp | string | null | undefined): string {
  if (!date) return 'N/A';

  let jsDate: Date;
  if (date instanceof Date) {
    jsDate = date;
  } else if (typeof date === 'string') {
    jsDate = new Date(date);
  } else {
    jsDate = new Date(date.seconds * 1000);
  }

  return format(jsDate, 'MMM d, yyyy');
}

/**
 * Converts Firestore Timestamp to JavaScript Date
 */
export function toDate(timestamp: Date | Timestamp | string | null | undefined): Date | null {
  if (!timestamp) return null;

  if (timestamp instanceof Date) {
    return timestamp;
  } else if (typeof timestamp === 'string') {
    return new Date(timestamp);
  } else {
    return new Date(timestamp.seconds * 1000);
  }
}

/**
 * Formats a date in compact style: "15m ago", "2h ago", or "Nov 13" for older dates
 */
export function formatCompactTime(date: Date | Timestamp | string | null | undefined): string {
  if (!date) return '—';

  const jsDate = toDate(date);
  if (!jsDate) return '—';

  const now = new Date();
  const diffMs = now.getTime() - jsDate.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMs >= 0 && diffMs < 24 * 60 * 60 * 1000) {
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${diffHours}h ago`;
  }

  return format(jsDate, 'MMM d');
}

/**
 * Calculates time-to-response as a compact string: "4m", "1h 23m"
 * Returns null if sentAt is null (not yet sent)
 */
export function calculateTTR(
  receivedAt: Date | Timestamp | string | null | undefined,
  sentAt: Date | Timestamp | string | null | undefined
): string | null {
  if (!sentAt) return null;

  const received = toDate(receivedAt);
  const sent = toDate(sentAt);
  if (!received || !sent) return null;

  const diffMs = sent.getTime() - received.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMins < 60) return `${Math.max(1, diffMins)}m`;
  if (diffMins < 60 * 24) {
    const mins = diffMins % 60;
    return mins > 0 ? `${diffHours}h ${mins}m` : `${diffHours}h`;
  }

  const days = Math.floor(diffHours / 24);
  return `${days}d`;
}

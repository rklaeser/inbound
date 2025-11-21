import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

/**
 * Formats a date in Vercel style: "Nov 13"
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

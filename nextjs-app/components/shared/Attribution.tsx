import { Timestamp } from 'firebase/firestore';
import { formatHumanDate } from '@/lib/date-utils';

interface AttributionProps {
  date: Date | Timestamp | string | null | undefined;
  by?: string | null;
}

/**
 * Displays Vercel-style attribution: "Nov 13 by Ryan" or "Nov 13 by Lead Agent"
 */
export function Attribution({ date, by }: AttributionProps) {
  if (!date) return null;

  const formattedDate = formatHumanDate(date);
  const actor = by || 'Lead Agent';

  return (
    <span
      className="font-mono"
      style={{
        fontSize: '12px',
        color: '#a1a1a1'
      }}
    >
      <span style={{ color: '#fafafa' }}>{formattedDate}</span>
      <span> by </span>
      <span style={{ color: '#fafafa' }}>{actor}</span>
    </span>
  );
}

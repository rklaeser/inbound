import { Timestamp } from 'firebase/firestore';
import { formatHumanDate } from '@/lib/date-utils';

interface AttributionProps {
  date: Date | Timestamp | string | null | undefined;
  by?: string | null;
}

/**
 * Displays Vercel-style attribution: "Nov 13 by Ryan" or just "Nov 13" if no actor
 */
export function Attribution({ date, by }: AttributionProps) {
  if (!date) return null;

  const formattedDate = formatHumanDate(date);

  return (
    <span className="font-mono text-xs text-muted-foreground">
      <span className="text-foreground">{formattedDate}</span>
      {by && (
        <>
          <span> by </span>
          <span className="text-foreground">{by}</span>
        </>
      )}
    </span>
  );
}

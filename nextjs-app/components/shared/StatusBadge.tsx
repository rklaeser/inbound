'use client';

import { LeadOutcome } from '@/lib/types';
import { getOutcomeConfig } from '@/lib/outcomes';

interface StatusBadgeProps {
  outcome: LeadOutcome;
}

export default function StatusBadge({ outcome }: StatusBadgeProps) {
  const config = getOutcomeConfig(outcome);

  return (
    <div
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium"
      style={{
        backgroundColor: config.colors.background,
        color: config.colors.text,
      }}
    >
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: config.colors.text }}
      />
      {config.label}
    </div>
  );
}

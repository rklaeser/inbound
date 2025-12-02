import * as React from 'react';
import type { Lead, Classification } from '@/lib/types';
import { getCurrentClassification, getClassificationLabel } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2 } from 'lucide-react';

type BadgeVariant = 'success' | 'muted' | 'info' | 'purple' | 'warning' | 'cyan' | 'pink' | 'processing';

interface BadgeInfo {
  label: string;
  variant: BadgeVariant;
  icon: React.ReactElement | null;
}

/**
 * Map classification to badge variant
 */
function getVariantForClassification(classification: Classification): BadgeVariant {
  switch (classification) {
    case 'high-quality': return 'success';
    case 'low-quality': return 'muted';
    case 'support': return 'info';
    case 'existing': return 'purple';
    default: return 'muted';
  }
}

/**
 * Determines the badge display for a lead based on status and classification
 */
function getBadgeForLead(lead: Lead): BadgeInfo {
  const { status } = lead;

  // Workflow is running (lead just submitted)
  if (status.status === 'processing') {
    return {
      label: 'Processing',
      variant: 'processing',
      icon: <Loader2 className="h-3 w-3 animate-spin" />
    };
  }

  // Rerouted leads awaiting review
  if (lead.reroute && (status.status === 'review' || status.status === 'classify')) {
    return {
      label: 'Rerouted',
      variant: 'warning',
      icon: <AlertCircle className="h-3 w-3" />
    };
  }

  // Waiting for human classification
  if (status.status === 'classify') {
    return {
      label: 'Needs Classification',
      variant: 'warning',
      icon: <AlertCircle className="h-3 w-3" />
    };
  }

  // Done or review → Show classification label
  const classification = getCurrentClassification(lead);
  if (classification) {
    return {
      label: getClassificationLabel(classification),
      variant: getVariantForClassification(classification),
      icon: null
    };
  }

  // Fallback for unknown state
  return {
    label: 'Unknown',
    variant: 'muted',
    icon: null
  };
}

interface LeadBadgeProps {
  lead: Lead;
}

/**
 * LeadBadge - Primary badge for lead display
 *
 * Shows classification label for done/review leads, or status for processing/classify.
 */
export function LeadBadge({ lead }: LeadBadgeProps) {
  const badge = getBadgeForLead(lead);

  return (
    <Badge variant={badge.variant} className="px-3 py-1">
      {badge.icon}
      {badge.label}
    </Badge>
  );
}

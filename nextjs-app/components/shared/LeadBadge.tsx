import * as React from 'react';
import type { Lead } from '@/lib/types';
import { Check, X, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { getOutcomeColors } from '@/lib/outcomes';
import { getClassificationColors } from '@/lib/classifications';

interface BadgeInfo {
  label: string;
  bg: string;
  text: string;
  border: string;
  icon: React.ReactElement | null;
}

/**
 * Determines the badge display for a lead based on outcome and classification
 *
 * Logic:
 * - Terminal outcomes (sent, dead, forwarded, error) → Show outcome
 * - Processing (outcome === null) → Show "Processing"
 * - Pending (outcome === 'pending') → Show action derived from classification
 */
function getBadgeForLead(lead: Lead): BadgeInfo {
  const { outcome, classification } = lead;

  // Processing state (outcome === null)
  if (outcome === null) {
    const colors = getOutcomeColors(null);
    return {
      label: 'Processing',
      bg: colors.background,
      text: colors.text,
      border: colors.border,
      icon: <Loader2 className="h-3 w-3 animate-spin" />
    };
  }

  // Terminal outcome: Error
  if (outcome === 'error') {
    const colors = getOutcomeColors('error');
    return {
      label: 'Error',
      bg: colors.background,
      text: colors.text,
      border: colors.border,
      icon: <AlertCircle className="h-3 w-3" />
    };
  }

  // Terminal outcome: Meeting Offer Sent
  if (outcome === 'sent_meeting_offer') {
    const colors = getOutcomeColors('sent_meeting_offer');
    return {
      label: 'Meeting Offer Sent',
      bg: colors.background,
      text: colors.text,
      border: colors.border,
      icon: <Check className="h-3 w-3" />
    };
  }

  // Terminal outcome: Generic Message Sent
  if (outcome === 'sent_generic') {
    const colors = getOutcomeColors('sent_generic');
    return {
      label: 'Generic Message Sent',
      bg: colors.background,
      text: colors.text,
      border: colors.border,
      icon: <Check className="h-3 w-3" />
    };
  }

  // Terminal outcome: Dead
  if (outcome === 'dead') {
    const colors = getOutcomeColors('dead');
    return {
      label: 'Dead',
      bg: colors.background,
      text: colors.text,
      border: colors.border,
      icon: <X className="h-3 w-3" />
    };
  }

  // Terminal outcome: Forwarded to Account Team
  if (outcome === 'forwarded_account_team') {
    const colors = getOutcomeColors('forwarded_account_team');
    return {
      label: 'Forwarded to Account Team',
      bg: colors.background,
      text: colors.text,
      border: colors.border,
      icon: <ArrowRight className="h-3 w-3" />
    };
  }

  // Terminal outcome: Forwarded to Support
  if (outcome === 'forwarded_support') {
    const colors = getOutcomeColors('forwarded_support');
    return {
      label: 'Forwarded to Support',
      bg: colors.background,
      text: colors.text,
      border: colors.border,
      icon: <ArrowRight className="h-3 w-3" />
    };
  }

  // Pending outcome - determine action from classification
  if (outcome === 'pending') {
    // Quality leads → "Reply with Meeting"
    if (classification === 'quality') {
      const colors = getClassificationColors('quality');
      return {
        label: 'Reply with Meeting',
        bg: colors.background,
        text: colors.text,
        border: colors.border,
        icon: <ArrowRight className="h-3 w-3" />
      };
    }

    // Support leads → "Confirm Support"
    if (classification === 'support') {
      const colors = getClassificationColors('support');
      return {
        label: 'Confirm Support',
        bg: colors.background,
        text: colors.text,
        border: colors.border,
        icon: <ArrowRight className="h-3 w-3" />
      };
    }

    // Duplicate leads → "Confirm Duplicate"
    if (classification === 'duplicate') {
      const colors = getClassificationColors('duplicate');
      return {
        label: 'Confirm Duplicate',
        bg: colors.background,
        text: colors.text,
        border: colors.border,
        icon: <ArrowRight className="h-3 w-3" />
      };
    }

    // Low-value leads → "Reply with Generic"
    if (classification === 'low-value') {
      const colors = getClassificationColors('low-value');
      return {
        label: 'Reply with Generic',
        bg: colors.background,
        text: colors.text,
        border: colors.border,
        icon: <ArrowRight className="h-3 w-3" />
      };
    }

    // Irrelevant or dead leads → "Confirm Dead"
    if (classification === 'irrelevant' || classification === 'dead') {
      const colors = getClassificationColors(classification);
      return {
        label: 'Confirm Dead',
        bg: colors.background,
        text: colors.text,
        border: colors.border,
        icon: <X className="h-3 w-3" />
      };
    }

    // Uncertain leads → "Review"
    if (classification === 'uncertain') {
      const colors = getClassificationColors('uncertain');
      return {
        label: 'Review',
        bg: colors.background,
        text: colors.text,
        border: colors.border,
        icon: <AlertCircle className="h-3 w-3" />
      };
    }

    // Default pending state (no classification yet)
    const colors = getOutcomeColors('pending');
    return {
      label: 'Pending',
      bg: colors.background,
      text: colors.text,
      border: colors.border,
      icon: null
    };
  }

  // Fallback for unknown state
  return {
    label: 'Unknown',
    bg: 'rgba(161,161,161,0.1)',
    text: '#a1a1a1',
    border: 'rgba(161,161,161,0.2)',
    icon: null
  };
}

interface LeadBadgeProps {
  lead: Lead;
}

/**
 * LeadBadge - Primary badge for lead display
 *
 * Shows:
 * - Terminal outcomes → what happened (Sent, Dead, Forwarded)
 * - Pending → what action to take (Review, Confirm Support, etc.)
 * - Processing/Error → current state
 */
export function LeadBadge({ lead }: LeadBadgeProps) {
  const badge = getBadgeForLead(lead);

  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border"
      style={{
        fontSize: '12px',
        fontWeight: 500,
        backgroundColor: badge.bg,
        color: badge.text,
        borderColor: badge.border,
        transition: 'all 0.15s ease'
      }}
    >
      {badge.icon}
      {badge.label}
    </span>
  );
}

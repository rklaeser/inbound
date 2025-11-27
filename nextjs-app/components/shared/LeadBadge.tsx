import * as React from 'react';
import type { Lead, Classification, TerminalState } from '@/lib/types';
import { getTerminalState, getCurrentClassification, getTerminalStateDisplay, getClassificationAction } from '@/lib/types';
import { Check, X, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

interface BadgeInfo {
  label: string;
  bg: string;
  text: string;
  border: string;
  icon: React.ReactElement | null;
}

/**
 * Get colors for a given color hex
 */
function getColorsFromHex(hex: string) {
  return {
    background: `${hex}1a`,  // 10% opacity
    text: hex,
    border: `${hex}33`,       // 20% opacity
  };
}

/**
 * Determines the badge display for a lead based on status and classification
 *
 * New model logic:
 * - status.status = 'done' → Show terminal state (derived from classification)
 * - status.status = 'review' + no classification → Show "Processing"
 * - status.status = 'review' + classification → Show action needed
 */
function getBadgeForLead(lead: Lead): BadgeInfo {
  const { status, classifications } = lead;

  // Check for terminal state (status = done)
  const terminalState = getTerminalState(lead);
  if (terminalState) {
    const display = getTerminalStateDisplay(terminalState);
    const colors = getColorsFromHex(display.color);

    // Choose icon based on terminal state
    let icon: React.ReactElement | null = <Check className="h-3 w-3" />;
    if (terminalState === 'dead') {
      icon = <X className="h-3 w-3" />;
    } else if (terminalState === 'forwarded_support' || terminalState === 'forwarded_account_team') {
      icon = <ArrowRight className="h-3 w-3" />;
    }

    return {
      label: display.label,
      bg: colors.background,
      text: colors.text,
      border: colors.border,
      icon,
    };
  }

  // In review with no classification yet → Processing
  if (status.status === 'review' && classifications.length === 0) {
    return {
      label: 'Processing',
      bg: 'rgba(245,158,11,0.1)',
      text: '#f59e0b',
      border: 'rgba(245,158,11,0.2)',
      icon: <Loader2 className="h-3 w-3 animate-spin" />
    };
  }

  // In review with classification → Show action needed
  if (status.status === 'review') {
    const classification = getCurrentClassification(lead);

    if (classification) {
      const action = getClassificationAction(classification);
      const colors = getColorsFromHex(action.color);
      const actionLabel = action.short;
      const icon = classification === 'irrelevant'
        ? <X className="h-3 w-3" />
        : <ArrowRight className="h-3 w-3" />;

      return {
        label: actionLabel,
        bg: colors.background,
        text: colors.text,
        border: colors.border,
        icon,
      };
    }
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
 * - Terminal state (done) → what happened (Sent, Dead, Forwarded)
 * - In review → what action to take (Review, Confirm Support, etc.)
 * - Processing → waiting for workflow
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

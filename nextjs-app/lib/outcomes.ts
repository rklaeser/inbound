import { Check, X, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import type { LeadOutcome } from './types';

/**
 * Centralized outcome (formerly status) configuration
 * This replaces the old statuses.ts with outcome-based model
 */

export interface OutcomeColors {
  text: string;
  background: string;
  border: string;
}

export interface OutcomeConfig {
  key: LeadOutcome;
  label: string;
  description: string;
  colors: OutcomeColors;
  icon: typeof Check | typeof X | typeof ArrowRight | typeof Loader2 | typeof AlertCircle | null;
  iconAnimated?: boolean;
  category: 'processing' | 'pending' | 'terminal' | 'error';
  isTerminal: boolean;
}

/**
 * Outcome configurations
 */
export const OUTCOMES: Record<string, OutcomeConfig> = {
  // Processing state (outcome === null)
  processing: {
    key: null,
    label: 'Processing',
    // Lead is in the automated workflow
    description: 'Lead is being processed by AI workflow',
    colors: {
      text: '#3b82f6',        // blue-500
      background: 'rgba(59, 130, 246, 0.1)',
      border: 'rgba(59, 130, 246, 0.2)',
    },
    icon: Loader2,
    iconAnimated: true,
    category: 'processing',
    isTerminal: false,
  },

  // Pending human decision
  pending: {
    key: 'pending',
    label: 'Pending',
    // Awaiting human review and decision
    description: 'Awaiting human review and decision',
    colors: {
      text: '#f59e0b',        // amber-500
      background: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.2)',
    },
    icon: null,  // Icon derived from classification via LeadBadge
    category: 'pending',
    isTerminal: false,
  },

  // Terminal outcomes
  sent_meeting_offer: {
    key: 'sent_meeting_offer',
    label: 'Meeting Offer Sent',
    // Meeting offer email sent to quality lead
    description: 'Meeting offer email sent',
    colors: {
      text: '#22c55e',        // green-500
      background: 'rgba(34, 197, 94, 0.1)',
      border: 'rgba(34, 197, 94, 0.2)',
    },
    icon: Check,
    category: 'terminal',
    isTerminal: true,
  },

  sent_generic: {
    key: 'sent_generic',
    label: 'Generic Message Sent',
    // Generic/sales email sent to non-quality lead
    description: 'Generic message sent',
    colors: {
      text: '#a1a1a1',        // gray-400
      background: 'rgba(161, 161, 161, 0.1)',
      border: 'rgba(161, 161, 161, 0.2)',
    },
    icon: Check,
    category: 'terminal',
    isTerminal: true,
  },

  dead: {
    key: 'dead',
    label: 'Dead',
    // Lead closed without sending
    description: 'Lead closed without sending email',
    colors: {
      text: '#a1a1a1',        // gray-400
      background: 'rgba(161, 161, 161, 0.1)',
      border: 'rgba(161, 161, 161, 0.2)',
    },
    icon: X,
    category: 'terminal',
    isTerminal: true,
  },

  forwarded_account_team: {
    key: 'forwarded_account_team',
    label: 'Forwarded to Account Team',
    // Forwarded to account team (for duplicates and high-value leads)
    description: 'Forwarded to account team',
    colors: {
      text: '#a855f7',        // purple-500
      background: 'rgba(168, 85, 247, 0.1)',
      border: 'rgba(168, 85, 247, 0.2)',
    },
    icon: ArrowRight,
    category: 'terminal',
    isTerminal: true,
  },

  forwarded_support: {
    key: 'forwarded_support',
    label: 'Forwarded to Support',
    // Forwarded to support team (for support requests)
    description: 'Forwarded to support team',
    colors: {
      text: '#3b82f6',        // blue-500
      background: 'rgba(59, 130, 246, 0.1)',
      border: 'rgba(59, 130, 246, 0.2)',
    },
    icon: ArrowRight,
    category: 'terminal',
    isTerminal: true,
  },

  // Error state
  error: {
    key: 'error',
    label: 'Error',
    // Workflow failed - requires manual intervention
    description: 'Processing failed - requires manual review',
    colors: {
      text: '#ef4444',        // red-500
      background: 'rgba(239, 68, 68, 0.1)',
      border: 'rgba(239, 68, 68, 0.2)',
    },
    icon: AlertCircle,
    category: 'error',
    isTerminal: true,
  },
};

/**
 * Helper functions for type-safe outcome access
 */

export function getOutcomeConfig(outcome: LeadOutcome): OutcomeConfig {
  if (outcome === null) return OUTCOMES.processing;
  return OUTCOMES[outcome] || OUTCOMES.processing;
}

export function getOutcomeColor(outcome: LeadOutcome): string {
  return getOutcomeConfig(outcome).colors.text;
}

export function getOutcomeColors(outcome: LeadOutcome): OutcomeColors {
  return getOutcomeConfig(outcome).colors;
}

export function getOutcomeLabel(outcome: LeadOutcome): string {
  return getOutcomeConfig(outcome).label;
}

export function getOutcomeIcon(outcome: LeadOutcome) {
  return getOutcomeConfig(outcome).icon;
}

export function isTerminalOutcome(outcome: LeadOutcome): boolean {
  return getOutcomeConfig(outcome).isTerminal;
}

/**
 * Get all terminal outcomes (sent_meeting_offer, sent_generic, dead, forwarded_account_team, forwarded_support, error)
 */
export const TERMINAL_OUTCOMES: LeadOutcome[] = ['sent_meeting_offer', 'sent_generic', 'dead', 'forwarded_account_team', 'forwarded_support', 'error'];

/**
 * Get all active outcomes (pending, sent_meeting_offer, sent_generic, dead, forwarded_account_team, forwarded_support, error)
 */
export const ACTIVE_OUTCOMES = Object.values(OUTCOMES)
  .filter(o => o.key !== null)
  .sort((a, b) => {
    // Sort order: pending, sent_meeting_offer, sent_generic, dead, forwarded_account_team, forwarded_support, error
    const order: Record<string, number> = { pending: 0, sent_meeting_offer: 1, sent_generic: 2, dead: 3, forwarded_account_team: 4, forwarded_support: 5, error: 6 };
    return (order[a.key as string] ?? 999) - (order[b.key as string] ?? 999);
  });

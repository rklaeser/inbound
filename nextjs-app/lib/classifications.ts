import type { LeadClassification } from './types';

/**
 * Centralized classification color system
 * Single source of truth for all classification colors
 */

export interface ClassificationColors {
  text: string;
  background: string;
  border: string;
}

export interface ClassificationConfig {
  key: LeadClassification;
  label: string;
  description: string;
  colors: ClassificationColors;
}

/**
 * Classification color configurations
 * Based on ActionBadge canonical colors
 */
export const CLASSIFICATIONS: Record<LeadClassification, ClassificationConfig> = {
  quality: {
    key: 'quality',
    label: 'Quality',
    // High-value lead worth personalized outreach
    description: 'High-value lead with clear product-market fit',
    colors: {
      text: '#22c55e',        // green-500
      background: 'rgba(34, 197, 94, 0.1)',
      border: 'rgba(34, 197, 94, 0.2)',
    },
  },

  support: {
    key: 'support',
    label: 'Support',
    // Existing customer needing support
    description: 'Existing customer with support request',
    colors: {
      text: '#f59e0b',        // amber-500 (yellow for pending action)
      background: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.2)',
    },
  },

  duplicate: {
    key: 'duplicate',
    label: 'Duplicate',
    // Duplicate of existing customer - forward to account team
    description: 'Duplicate submission from existing customer',
    colors: {
      text: '#f59e0b',        // amber-500 (yellow for pending action)
      background: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.2)',
    },
  },

  'low-value': {
    key: 'low-value',
    label: 'Low-Value',
    // Real opportunity but not a good fit (small company, limited budget, etc.)
    description: 'Real opportunity but not a good fit for personalized outreach',
    colors: {
      text: '#f59e0b',        // amber-500 (yellow for pending action)
      background: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.2)',
    },
  },

  irrelevant: {
    key: 'irrelevant',
    label: 'Irrelevant',
    // Spam, test submissions, nonsense - not a real lead
    description: 'Spam, test submission, or otherwise irrelevant',
    colors: {
      text: '#f59e0b',        // amber-500 (yellow for pending action)
      background: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.2)',
    },
  },

  uncertain: {
    key: 'uncertain',
    label: 'Uncertain',
    // AI is not confident - needs human assessment
    description: 'Uncertain classification requiring human review',
    colors: {
      text: '#f59e0b',        // amber-500 (yellow for pending action)
      background: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.2)',
    },
  },

  dead: {
    key: 'dead',
    label: 'Dead',
    // Clearly not a lead (test, competitor, etc.)
    description: 'Not a valid lead (test submission, competitor, etc.)',
    colors: {
      text: '#f59e0b',        // amber-500 (yellow for pending action)
      background: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.2)',
    },
  },
};

/**
 * Helper functions for type-safe classification access
 */

export function getClassificationConfig(classification: LeadClassification): ClassificationConfig {
  return CLASSIFICATIONS[classification];
}

export function getClassificationColors(classification: LeadClassification): ClassificationColors {
  return CLASSIFICATIONS[classification].colors;
}

export function getClassificationLabel(classification: LeadClassification): string {
  return CLASSIFICATIONS[classification].label;
}

export function getClassificationDescription(classification: LeadClassification): string {
  return CLASSIFICATIONS[classification].description;
}

/**
 * Get all classifications as an array
 */
export const ALL_CLASSIFICATIONS = Object.values(CLASSIFICATIONS);

// Helper functions for configuration operations

import { adminDb } from "./db";
import type { Configuration, Classification } from "./types";
import { DEFAULT_CONFIGURATION } from "./types";

// Simple cache for configuration
let configCache: Configuration | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 60 * 1000; // 60 seconds

/**
 * Get the system configuration
 * Cached for 60 seconds to improve performance
 */
export async function getConfiguration(): Promise<Configuration> {
  const now = Date.now();

  // Return cached if valid
  if (configCache && now - cacheTimestamp < CACHE_DURATION_MS) {
    return configCache;
  }

  try {
    const doc = await adminDb
      .collection('settings')
      .doc('configuration')
      .get();

    if (!doc.exists) {
      // Initialize default configuration if missing
      await initializeConfiguration();
      return getConfiguration();
    }

    const configuration = doc.data() as Configuration;

    // Update cache
    configCache = configuration;
    cacheTimestamp = now;

    return configuration;
  } catch (error) {
    console.error('Error fetching configuration:', error);
    throw error;
  }
}

/**
 * Update system configuration
 */
export async function updateConfiguration(
  updates: Partial<Configuration>,
  updatedBy: string = 'system'
): Promise<void> {
  try {
    await adminDb
      .collection('settings')
      .doc('configuration')
      .update({
        ...updates,
        updated_at: new Date(),
        updated_by: updatedBy,
      });

    // Invalidate cache
    invalidateConfigurationCache();

    console.log('Configuration updated successfully');
  } catch (error) {
    console.error('Error updating configuration:', error);
    throw error;
  }
}

/**
 * Initialize default configuration (for new setups)
 */
export async function initializeConfiguration(): Promise<void> {
  const { CLASSIFICATION_PROMPT, EMAIL_GENERATION_PROMPT, CLASSIFICATION_EVAL_PROMPT, EMAIL_HIGH_QUALITY_EVAL_PROMPT } = await import('./settings-defaults');

  const defaultConfig: Configuration = {
    ...DEFAULT_CONFIGURATION,
    prompts: {
      classification: CLASSIFICATION_PROMPT,
      emailHighQuality: EMAIL_GENERATION_PROMPT,
      classificationEval: CLASSIFICATION_EVAL_PROMPT,
      emailHighQualityEval: EMAIL_HIGH_QUALITY_EVAL_PROMPT,
    },
    updated_at: new Date(),
    updated_by: 'system',
  };

  await adminDb
    .collection('settings')
    .doc('configuration')
    .set(defaultConfig);

  // Invalidate cache
  invalidateConfigurationCache();

  console.log('Default configuration initialized');
}

/**
 * Reset configuration to defaults (delete and recreate)
 */
export async function resetConfiguration(): Promise<void> {
  try {
    // Delete existing configuration
    await adminDb
      .collection('settings')
      .doc('configuration')
      .delete();

    // Invalidate cache
    invalidateConfigurationCache();

    // Recreate with defaults
    await initializeConfiguration();

    console.log('Configuration reset to defaults');
  } catch (error) {
    console.error('Error resetting configuration:', error);
    throw error;
  }
}

/**
 * Invalidate the configuration cache
 * Call this after updating configuration
 */
export function invalidateConfigurationCache() {
  configCache = null;
  cacheTimestamp = 0;
}

/**
 * Get threshold for a specific classification type
 */
export function getThresholdForClassification(
  config: Configuration,
  classification: Classification
): number {
  switch (classification) {
    case 'high-quality':
      return config.thresholds.highQuality;
    case 'low-quality':
      return config.thresholds.lowQuality;
    case 'support':
      return config.thresholds.support;
    case 'existing':
      // Existing customers are handled deterministically by CRM check before this is called
      // Return 0 to always pass threshold if this is somehow reached
      return 0;
    default:
      return 0;
  }
}

/**
 * Determine if a lead should auto-send based on confidence and rollout settings
 */
export function shouldAutoSend(
  confidence: number,
  threshold: number,
  rollout: Configuration['rollout']
): boolean {
  // Must pass confidence threshold
  if (confidence < threshold) {
    return false;
  }

  // Random roll against percentage (0 = disabled, 1 = 100%)
  return Math.random() < rollout.percentage;
}

/**
 * Get AI prompts from configuration
 */
export async function getPrompts() {
  const config = await getConfiguration();
  return config.prompts;
}

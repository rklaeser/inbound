// Helper functions for configuration operations

import { adminDb } from "./firestore-admin";
import type { Configuration } from "./types";

// Cache for active configuration (revalidated every 60 seconds)
let activeConfigurationCache: {
  configuration: Configuration | null;
  timestamp: number;
} = {
  configuration: null,
  timestamp: 0,
};

const CACHE_DURATION_MS = 60 * 1000; // 60 seconds

/**
 * Get the currently active configuration
 * Results are cached for 60 seconds to improve performance
 * Throws an error if no active configuration exists
 */
export async function getActiveConfiguration(): Promise<Configuration> {
  const now = Date.now();

  // Return cached configuration if still valid
  if (
    activeConfigurationCache.configuration &&
    now - activeConfigurationCache.timestamp < CACHE_DURATION_MS
  ) {
    return activeConfigurationCache.configuration;
  }

  try {
    const snapshot = await adminDb
      .collection("configurations")
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (snapshot.empty) {
      throw new Error("No active configuration found. Please initialize a configuration first.");
    }

    const doc = snapshot.docs[0];
    const configuration: Configuration = {
      id: doc.id,
      ...doc.data(),
    } as Configuration;

    // Update cache
    activeConfigurationCache = {
      configuration,
      timestamp: now,
    };

    return configuration;
  } catch (error) {
    console.error("Error fetching active configuration:", error);
    throw error; // Re-throw so calling code can handle it
  }
}

/**
 * Invalidate the active configuration cache
 * Call this after activating or archiving a configuration
 */
export function invalidateConfigurationCache() {
  activeConfigurationCache = {
    configuration: null,
    timestamp: 0,
  };
}

/**
 * Get a specific configuration by ID
 */
export async function getConfigurationById(id: string): Promise<Configuration | null> {
  try {
    const doc = await adminDb
      .collection("configurations")
      .doc(id)
      .get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
    } as Configuration;
  } catch (error) {
    console.error("Error fetching configuration:", error);
    return null;
  }
}

/**
 * Get configuration settings
 */
export async function getConfigurationSettings() {
  const configuration = await getActiveConfiguration();
  return configuration.settings;
}

/**
 * Get AI prompts
 * Always returns prompts from code (single source of truth)
 */
export async function getPrompts() {
  const { CLASSIFICATION_PROMPT, EMAIL_GENERATION_PROMPT } = await import('./prompts');
  return {
    classification: CLASSIFICATION_PROMPT,
    emailGeneration: EMAIL_GENERATION_PROMPT
  };
}

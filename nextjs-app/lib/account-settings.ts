import { adminDb } from './firestore-server';
import type { SystemSettings } from './types';

export const DEFAULT_ACCOUNT_SETTINGS: SystemSettings = {
  autoRejectConfidenceThreshold: 0.9,
  qualityLeadConfidenceThreshold: 0.7,
  sdr: {
    name: 'Ryan',
    email: 'ryan@vercel.com'
  }
};

/**
 * Get account settings from Firestore
 * Returns default settings if not found
 */
export async function getAccountSettings(): Promise<SystemSettings> {
  try {
    const settingsDoc = await adminDb.collection('settings').doc('system').get();

    if (!settingsDoc.exists) {
      return DEFAULT_ACCOUNT_SETTINGS;
    }

    const data = settingsDoc.data() as SystemSettings;

    // Ensure SDR fields exist (for backward compatibility)
    if (!data.sdr) {
      return {
        ...data,
        sdr: DEFAULT_ACCOUNT_SETTINGS.sdr
      };
    }

    return data;
  } catch (error) {
    console.error('Error fetching account settings:', error);
    return DEFAULT_ACCOUNT_SETTINGS;
  }
}

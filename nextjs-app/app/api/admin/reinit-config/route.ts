// POST /api/admin/reinit-config
// Reinitialize the active configuration with baseline/default settings

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firestore-admin";
import type { Configuration } from "@/lib/types";
import { invalidateConfigurationCache } from "@/lib/configuration-helpers";

// Helper to generate configuration ID
function generateConfigurationId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'cfg_';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Default baseline configuration settings
const BASELINE_SETTINGS = {
  autoRejectConfidenceThreshold: 0.9,
  qualityLeadConfidenceThreshold: 0.7,
};

const BASELINE_EMAIL_TEMPLATE = {
  subject: "Hi from Vercel",
  greeting: "Hi {firstName},",
  signOff: "Best,",
  callToAction: "Let's schedule a quick 15-minute call to discuss how Vercel can help.",
};

export async function POST() {
  try {
    // Get the highest version number to determine next version
    const latestConfigurationSnapshot = await adminDb
      .collection("configurations")
      .orderBy("version", "desc")
      .limit(1)
      .get();

    const nextVersion = latestConfigurationSnapshot.empty
      ? 1
      : (latestConfigurationSnapshot.docs[0].data().version || 0) + 1;

    // Archive all existing active configurations
    const activeConfigurations = await adminDb
      .collection("configurations")
      .where("status", "==", "active")
      .get();

    const batch = adminDb.batch();
    activeConfigurations.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: "archived",
        archived_at: new Date(),
      });
    });
    await batch.commit();

    console.log(`✓ Archived ${activeConfigurations.docs.length} existing active configuration(s)`);

    // Generate a unique configuration ID
    const configurationId = generateConfigurationId();

    // Create the new baseline configuration
    const configurationData: Omit<Configuration, 'id'> = {
      version: nextVersion,
      name: configurationId,
      status: 'active',
      settings: BASELINE_SETTINGS,
      emailTemplate: BASELINE_EMAIL_TEMPLATE,
      created_by: "system",
      activated_at: new Date(),
      created_at: new Date(),
      archived_at: null,
    };

    // Create the configuration in Firestore
    const docRef = adminDb.collection("configurations").doc(configurationId);
    await docRef.set(configurationData);

    const configuration: Configuration = {
      id: docRef.id,
      ...configurationData,
    };

    // Invalidate the configuration cache
    invalidateConfigurationCache();

    console.log(`✓ Created new baseline configuration ${configurationId} (version ${nextVersion})`);

    return NextResponse.json({
      success: true,
      configuration,
      message: "Configuration reinitialized successfully",
    });
  } catch (error) {
    console.error("Error reinitializing configuration:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET /api/configurations - List all configurations
// POST /api/configurations - Create a new configuration

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firestore-admin";
import type { Configuration } from "@/lib/types";
import { z } from "zod";

// Helper to generate configuration ID
function generateConfigurationId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'cfg_';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Validation schema for creating a configuration
const createConfigurationSchema = z.object({
  settings: z.object({
    autoDeadLowValueThreshold: z.number().min(0).max(1),
    autoDeadIrrelevantThreshold: z.number().min(0).max(1),
    autoForwardDuplicateThreshold: z.number().min(0).max(1),
    autoForwardSupportThreshold: z.number().min(0).max(1),
    autoSendQualityThreshold: z.number().min(0).max(1),
    qualityLeadConfidenceThreshold: z.number().min(0).max(1),
  }),
  emailTemplate: z.object({
    style: z.string().optional(),
    subject: z.string().min(1).optional(),
    greeting: z.string().min(1).optional(),
    signOff: z.string().min(1).optional(),
    callToAction: z.string().min(1).optional(),
    lowValueCallToAction: z.string().min(1).optional(),
  }).optional(),
  status: z.enum(['draft', 'active']).default('draft'),
});

// GET - List all configurations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // Filter by status if provided

    let query = adminDb.collection("configurations").orderBy("created_at", "desc");

    if (status && ['draft', 'active', 'archived'].includes(status)) {
      query = query.where("status", "==", status) as any;
    }

    const snapshot = await query.get();

    const configurations: Configuration[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Configuration));

    return NextResponse.json({
      success: true,
      configurations,
      count: configurations.length,
    });
  } catch (error) {
    console.error("Error fetching configurations:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch configurations",
      },
      { status: 500 }
    );
  }
}

// POST - Create a new configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validationResult = createConfigurationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid configuration data",
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Get the highest version number to determine next version
    const latestConfigurationSnapshot = await adminDb
      .collection("configurations")
      .orderBy("version", "desc")
      .limit(1)
      .get();

    const nextVersion = latestConfigurationSnapshot.empty
      ? 1
      : (latestConfigurationSnapshot.docs[0].data().version || 0) + 1;

    // If creating as 'active', archive the current active configuration
    if (data.status === 'active') {
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
    }

    // Generate a unique configuration ID
    const configurationId = generateConfigurationId();

    // Create the new configuration
    const configurationData: Omit<Configuration, 'id'> = {
      version: nextVersion,
      name: configurationId, // Use generated ID as name
      status: data.status,
      settings: data.settings,
      emailTemplate: data.emailTemplate || {},
      created_by: "system", // TODO: Add actual user ID when auth is implemented
      activated_at: data.status === 'active' ? new Date() : null,
      created_at: new Date(),
      archived_at: null,
    };

    // Use the generated ID as the document ID
    const docRef = adminDb.collection("configurations").doc(configurationId);
    await docRef.set(configurationData);

    const configuration: Configuration = {
      id: docRef.id,
      ...configurationData,
    };

    return NextResponse.json({
      success: true,
      configuration,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating configuration:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create configuration",
      },
      { status: 500 }
    );
  }
}

// POST /api/configurations/[id]/activate - Activate a draft configuration (make it active)

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firestore-admin";
import type { Configuration } from "@/lib/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if configuration exists and is a draft
    const configurationDoc = await adminDb
      .collection("configurations")
      .doc(id)
      .get();

    if (!configurationDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: "Configuration not found",
        },
        { status: 404 }
      );
    }

    const currentConfiguration = configurationDoc.data() as Configuration;

    if (currentConfiguration.status !== 'draft') {
      return NextResponse.json(
        {
          success: false,
          error: "Only draft configurations can be activated",
        },
        { status: 400 }
      );
    }

    // Archive all currently active configurations
    const activeConfigurations = await adminDb
      .collection("configurations")
      .where("status", "==", "active")
      .get();

    const batch = adminDb.batch();

    // Archive existing active configurations
    activeConfigurations.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: "archived",
        archived_at: new Date(),
      });
    });

    // Activate the target configuration
    batch.update(configurationDoc.ref, {
      status: "active",
      activated_at: new Date(),
    });

    await batch.commit();

    // Fetch updated configuration
    const updatedDoc = await adminDb
      .collection("configurations")
      .doc(id)
      .get();

    const configuration: Configuration = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    } as Configuration;

    return NextResponse.json({
      success: true,
      configuration,
      message: "Configuration activated successfully",
    });
  } catch (error) {
    console.error("Error activating configuration:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to activate configuration",
      },
      { status: 500 }
    );
  }
}

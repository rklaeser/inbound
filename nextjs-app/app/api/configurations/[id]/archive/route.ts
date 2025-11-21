// POST /api/configurations/[id]/archive - Archive a configuration

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firestore-admin";
import type { Configuration } from "@/lib/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if configuration exists
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

    // Can't archive if it's the only active configuration
    if (currentConfiguration.status === 'active') {
      const activeCount = await adminDb
        .collection("configurations")
        .where("status", "==", "active")
        .count()
        .get();

      if (activeCount.data().count <= 1) {
        return NextResponse.json(
          {
            success: false,
            error: "Cannot archive the only active configuration. Activate a new version first.",
          },
          { status: 400 }
        );
      }
    }

    // Archive the configuration
    await adminDb
      .collection("configurations")
      .doc(id)
      .update({
        status: "archived",
        archived_at: new Date(),
      });

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
      message: "Configuration archived successfully",
    });
  } catch (error) {
    console.error("Error archiving configuration:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to archive configuration",
      },
      { status: 500 }
    );
  }
}

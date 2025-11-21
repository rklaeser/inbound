// GET /api/analytics/configurations/[id]
// Get metrics for a specific configuration

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firestore-admin";
import { calculateConfigurationMetrics } from "@/lib/metrics-helpers";
import type { Configuration } from "@/lib/types";

export async function GET(
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

    const configuration: Configuration = {
      id: configurationDoc.id,
      ...configurationDoc.data(),
    } as Configuration;

    // Calculate metrics
    const metrics = await calculateConfigurationMetrics(id);

    return NextResponse.json({
      success: true,
      configuration,
      metrics,
    });
  } catch (error) {
    console.error("Error fetching configuration metrics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch configuration metrics",
      },
      { status: 500 }
    );
  }
}

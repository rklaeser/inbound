// GET /api/configurations/[id] - Get a specific configuration
// PATCH /api/configurations/[id] - Update a configuration (only drafts can be updated)
// DELETE /api/configurations/[id] - Delete a configuration (only drafts can be deleted)

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firestore-admin";
import type { Configuration } from "@/lib/types";
import { z } from "zod";

// Validation schema for updating a configuration
const updateConfigurationSchema = z.object({
  settings: z.object({
    autoRejectConfidenceThreshold: z.number().min(0).max(1),
    qualityLeadConfidenceThreshold: z.number().min(0).max(1),
  }).optional(),
  prompts: z.object({
    classification: z.string().min(10),
    emailGeneration: z.string().min(10),
  }).optional(),
  emailTemplate: z.object({
    style: z.string().optional(),
  }).optional(),
});

// GET - Fetch a specific configuration
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    return NextResponse.json({
      success: true,
      configuration,
    });
  } catch (error) {
    console.error("Error fetching configuration:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch configuration",
      },
      { status: 500 }
    );
  }
}

// PATCH - Update a configuration (only drafts)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validationResult = updateConfigurationSchema.safeParse(body);
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
          error: "Only draft configurations can be updated",
        },
        { status: 400 }
      );
    }

    // Update the configuration
    const updateData: Partial<Configuration> = {
      ...data,
    };

    await adminDb
      .collection("configurations")
      .doc(id)
      .update(updateData);

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
    });
  } catch (error) {
    console.error("Error updating configuration:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update configuration",
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete a configuration (only drafts)
export async function DELETE(
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
          error: "Only draft configurations can be deleted",
        },
        { status: 400 }
      );
    }

    // Delete the configuration
    await adminDb.collection("configurations").doc(id).delete();

    return NextResponse.json({
      success: true,
      message: "Configuration deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting configuration:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete configuration",
      },
      { status: 500 }
    );
  }
}

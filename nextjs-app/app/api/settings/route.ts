// GET /api/settings - Get system settings
// POST /api/settings - Update system settings

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firestore-admin";
import type { SystemSettings } from "@/lib/types";
import { z } from "zod";

const SETTINGS_DOC_ID = "system";

// Default settings
const DEFAULT_SETTINGS: SystemSettings = {
  autoRejectConfidenceThreshold: 0.9,
  qualityLeadConfidenceThreshold: 0.7,
  sdr: {
    name: 'Ryan',
    email: 'ryan@vercel.com'
  }
};

// Validation schema
const settingsSchema = z.object({
  autoRejectConfidenceThreshold: z.number().min(0).max(1),
  qualityLeadConfidenceThreshold: z.number().min(0).max(1),
  sdr: z.object({
    name: z.string().min(1, 'SDR name is required'),
    email: z.string().email('Valid email is required')
  })
});

// GET - Fetch current settings
export async function GET() {
  try {
    const settingsDoc = await adminDb
      .collection("settings")
      .doc(SETTINGS_DOC_ID)
      .get();

    if (!settingsDoc.exists) {
      // Return default settings if none exist
      return NextResponse.json({
        success: true,
        settings: DEFAULT_SETTINGS,
      });
    }

    const settings = settingsDoc.data() as SystemSettings;

    // Ensure SDR fields exist (for backward compatibility)
    const sdr = settings.sdr || DEFAULT_SETTINGS.sdr;

    return NextResponse.json({
      success: true,
      settings: {
        autoRejectConfidenceThreshold: settings.autoRejectConfidenceThreshold,
        qualityLeadConfidenceThreshold: settings.qualityLeadConfidenceThreshold,
        sdr
      },
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch settings",
      },
      { status: 500 }
    );
  }
}

// POST - Update settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validationResult = settingsSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid settings values",
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const settings = validationResult.data;

    // Update settings in Firestore
    await adminDb
      .collection("settings")
      .doc(SETTINGS_DOC_ID)
      .set(
        {
          ...settings,
          updated_at: new Date(),
        },
        { merge: true }
      );

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update settings",
      },
      { status: 500 }
    );
  }
}

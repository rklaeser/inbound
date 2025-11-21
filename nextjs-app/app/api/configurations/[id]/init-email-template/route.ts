// POST /api/configurations/[id]/init-email-template
// Initialize email template with default values

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firestore-admin";
import { invalidateConfigurationCache } from "@/lib/configuration-helpers";

const DEFAULT_EMAIL_TEMPLATE = {
  subject: "Hi from Vercel",
  greeting: "Hi {firstName},",
  signOff: "Best,",
  callToAction: "Let's schedule a quick 15-minute call to discuss how Vercel can help.",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if configuration exists
    const configRef = adminDb.collection("configurations").doc(id);
    const configDoc = await configRef.get();

    if (!configDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: "Configuration not found",
        },
        { status: 404 }
      );
    }

    // Update the configuration with the email template
    await configRef.update({
      emailTemplate: DEFAULT_EMAIL_TEMPLATE,
    });

    // Invalidate cache
    invalidateConfigurationCache();

    console.log(`✓ Initialized email template for configuration ${id}`);

    // Fetch and return the updated configuration
    const updatedDoc = await configRef.get();
    const configuration = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    };

    return NextResponse.json({
      success: true,
      configuration,
      message: "Email template initialized successfully",
    });
  } catch (error) {
    console.error("Error initializing email template:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

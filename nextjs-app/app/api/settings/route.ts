// GET /api/settings - Get current configuration
// PATCH /api/settings - Update configuration
// DELETE /api/settings - Reset to default configuration

import { NextRequest, NextResponse } from 'next/server';
import { getConfiguration, updateConfiguration, initializeConfiguration, resetConfiguration } from '@/lib/configuration-helpers';
import { z } from 'zod';

// Email template schema (shared structure)
const emailTemplateBaseSchema = z.object({
  subject: z.string().optional(),
  greeting: z.string().optional(),
  callToAction: z.string().optional(),
  signOff: z.string().optional(),
});

const emailTemplateWithSenderSchema = emailTemplateBaseSchema.extend({
  senderName: z.string().optional(),
  senderEmail: z.string().optional(),
});

// Internal notification template schema (subject + body only)
const internalNotificationSchema = z.object({
  subject: z.string().optional(),
  body: z.string().optional(),
});

// Validation schema for configuration updates
const updateConfigurationSchema = z.object({
  thresholds: z.object({
    highQuality: z.number().min(0).max(1).optional(),
    lowQuality: z.number().min(0).max(1).optional(),
    support: z.number().min(0).max(1).optional(),
    duplicate: z.number().min(0).max(1).optional(),
    irrelevant: z.number().min(0).max(1).optional(),
  }).optional(),
  sdr: z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
  }).optional(),
  supportTeam: z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
  }).optional(),
  emailTemplates: z.object({
    highQuality: emailTemplateBaseSchema.optional(),
    lowQuality: emailTemplateWithSenderSchema.optional(),
    support: emailTemplateWithSenderSchema.optional(),
    duplicate: emailTemplateWithSenderSchema.optional(),
    supportInternal: internalNotificationSchema.optional(),
    duplicateInternal: internalNotificationSchema.optional(),
  }).optional(),
  prompts: z.object({
    classification: z.string().optional(),
    emailHighQuality: z.string().optional(),
    emailLowQuality: z.string().optional(),
    emailGeneric: z.string().optional(),
  }).optional(),
  rollout: z.object({
    enabled: z.boolean().optional(),
    percentage: z.number().min(0).max(1).optional(),
  }).optional(),
  email: z.object({
    enabled: z.boolean().optional(),
    testMode: z.boolean().optional(),
    testEmail: z.string().email().optional(),
  }).optional(),
});

// GET - Get current configuration
export async function GET() {
  try {
    let configuration;

    try {
      configuration = await getConfiguration();
    } catch {
      // If configuration doesn't exist, initialize it
      console.log('No configuration found, initializing default configuration...');
      await initializeConfiguration();
      configuration = await getConfiguration();
    }

    return NextResponse.json({
      success: true,
      configuration,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch settings',
      },
      { status: 500 }
    );
  }
}

// PATCH - Update configuration
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validationResult = updateConfigurationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid configuration data',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    // Get user from middleware (or hardcoded for now)
    const userEmail = request.headers.get('x-user-email') || 'system';

    // Update configuration - cast to Partial<Configuration> since we're doing partial updates
    await updateConfiguration(validationResult.data as Partial<import('@/lib/types').Configuration>, userEmail);

    // Return updated configuration
    const updatedConfig = await getConfiguration();

    return NextResponse.json({
      success: true,
      configuration: updatedConfig,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update settings',
      },
      { status: 500 }
    );
  }
}

// DELETE - Reset configuration to defaults
export async function DELETE() {
  try {
    await resetConfiguration();
    const configuration = await getConfiguration();

    return NextResponse.json({
      success: true,
      message: 'Configuration reset to defaults',
      configuration,
    });
  } catch (error) {
    console.error('Error resetting settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reset settings',
      },
      { status: 500 }
    );
  }
}

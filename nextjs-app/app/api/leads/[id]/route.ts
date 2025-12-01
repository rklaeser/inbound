// GET /api/leads/[id]
// Get individual lead by ID

// PATCH /api/leads/[id]
// Update individual lead

import { NextRequest } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/db";
import { successResponse, ApiErrors } from "@/lib/api";

// Schema for allowed PATCH updates
// This whitelist prevents arbitrary field updates
const leadUpdateSchema = z.object({
  // Edit note for context (reroute reasons, etc.)
  edit_note: z.string().nullable().optional(),
  // Matched case studies can be updated
  matched_case_studies: z.array(z.object({
    caseStudyId: z.string(),
    company: z.string(),
    industry: z.string(),
    url: z.string(),
    matchType: z.enum(['industry', 'problem', 'mentioned']),
    matchReason: z.string(),
    logoSvg: z.string().optional(),
    featuredText: z.string().optional(),
  })).optional(),
}).strict(); // strict() rejects unknown fields

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch lead document
    const leadDoc = await adminDb.collection("leads").doc(id).get();

    if (!leadDoc.exists) {
      return ApiErrors.notFound("Lead");
    }

    const leadData = leadDoc.data();
    return successResponse({ lead: { id: leadDoc.id, ...leadData } });
  } catch (error) {
    console.error("Error fetching lead:", error);
    return ApiErrors.internal("Failed to fetch lead");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input against whitelist schema
    const validationResult = leadUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return ApiErrors.validationError(validationResult.error.errors);
    }

    // Check if lead exists
    const leadDoc = await adminDb.collection("leads").doc(id).get();
    if (!leadDoc.exists) {
      return ApiErrors.notFound("Lead");
    }

    // Only update validated fields (whitelist approach)
    const updateData = validationResult.data;

    // Only perform update if there are fields to update
    if (Object.keys(updateData).length > 0) {
      await adminDb.collection("leads").doc(id).update(updateData);
    }

    // Fetch updated lead
    const updatedDoc = await adminDb.collection("leads").doc(id).get();
    return successResponse({ lead: { id: updatedDoc.id, ...updatedDoc.data() } });
  } catch (error) {
    console.error("Error updating lead:", error);
    return ApiErrors.internal("Failed to update lead");
  }
}

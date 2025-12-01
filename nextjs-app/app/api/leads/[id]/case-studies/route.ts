// PATCH /api/leads/[id]/case-studies
// Update matched case studies for a lead (recorded as human edit)

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/db";
import { z } from "zod";
import type { Lead } from "@/lib/types";

// Validation schema for case study updates
const caseStudySchema = z.object({
  caseStudyId: z.string(),
  company: z.string(),
  industry: z.string(),
  url: z.string(),
  matchType: z.enum(['industry', 'problem', 'mentioned']),
  matchReason: z.string(),
  // Display data
  logoSvg: z.string().optional(),
  featuredText: z.string().optional(),
});

const updateCaseStudiesSchema = z.object({
  case_studies: z.array(caseStudySchema),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validationResult = updateCaseStudiesSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const { case_studies } = validationResult.data;

    // Check if lead exists
    const leadDoc = await adminDb.collection("leads").doc(id).get();

    if (!leadDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: "Lead not found",
        },
        { status: 404 }
      );
    }

    const lead = { id: leadDoc.id, ...leadDoc.data() } as Lead;

    // Record what changed for human_edits note
    const oldCaseStudies = lead.matched_case_studies || [];
    const oldIds = oldCaseStudies.map(cs => cs.caseStudyId);
    const newIds = case_studies.map(cs => cs.caseStudyId);

    // Determine the type of change
    let changeNote = '';
    const added = newIds.filter(id => !oldIds.includes(id));
    const removed = oldIds.filter(id => !newIds.includes(id));
    const reordered = added.length === 0 && removed.length === 0 &&
      JSON.stringify(oldIds) !== JSON.stringify(newIds);

    if (added.length > 0) {
      const addedNames = case_studies
        .filter(cs => added.includes(cs.caseStudyId))
        .map(cs => cs.company);
      changeNote += `Added: ${addedNames.join(', ')}. `;
    }
    if (removed.length > 0) {
      const removedNames = oldCaseStudies
        .filter(cs => removed.includes(cs.caseStudyId))
        .map(cs => cs.company);
      changeNote += `Removed: ${removedNames.join(', ')}. `;
    }
    if (reordered) {
      changeNote += 'Reordered case studies. ';
    }

    // Update matched_case_studies and record as human edit
    const updateData: Record<string, unknown> = {
      matched_case_studies: case_studies,
    };

    // Add note about case study changes
    if (changeNote) {
      const existingNote = lead.edit_note || '';
      const caseStudyEditNote = `[Case Studies] ${changeNote.trim()}`;
      const combinedNote = existingNote
        ? `${existingNote}\n${caseStudyEditNote}`
        : caseStudyEditNote;
      updateData["edit_note"] = combinedNote;
    }

    await adminDb.collection("leads").doc(id).update(updateData);

    return NextResponse.json({
      success: true,
      matched_case_studies: case_studies,
      change_note: changeNote.trim(),
    });
  } catch (error) {
    console.error("Error updating case studies:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update case studies",
      },
      { status: 500 }
    );
  }
}

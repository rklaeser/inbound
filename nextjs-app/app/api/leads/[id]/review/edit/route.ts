// PATCH /api/leads/[id]/review/edit
// Edit the email text for a lead in review status

import { NextRequest } from "next/server";
import { adminDb } from "@/lib/db";
import { z } from "zod";
import type { Lead } from "@/lib/types";
import { successResponse, ApiErrors } from "@/lib/api";
import { logEmailEditEvent } from "@/lib/analytics-helpers";

const editSchema = z.object({
  email_text: z.string().min(1, "Email text is required"),
  edit_note: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validationResult = editSchema.safeParse(body);
    if (!validationResult.success) {
      return ApiErrors.validationError(validationResult.error.errors);
    }

    const { email_text, edit_note } = validationResult.data;

    // Check if lead exists
    const leadDoc = await adminDb.collection("leads").doc(id).get();
    if (!leadDoc.exists) {
      return ApiErrors.notFound("Lead");
    }

    const lead = { id: leadDoc.id, ...leadDoc.data() } as Lead;
    const now = new Date();

    // Get original text for analytics
    const originalText = lead.email?.text || "";

    // Update email with the edited text
    await adminDb.collection("leads").doc(id).update({
      "email.text": email_text,
      "email.editedAt": now,
      "email.lastEditedBy": "human", // TODO: Get actual user name when auth is added
      edit_note: edit_note || lead.edit_note || null,
    });

    // Log edit event
    await logEmailEditEvent(lead, "Original", originalText, "Edited", email_text);

    // Fetch updated lead
    const updatedDoc = await adminDb.collection("leads").doc(id).get();
    return successResponse({ lead: { id: updatedDoc.id, ...updatedDoc.data() } });
  } catch (error) {
    console.error("Error editing lead email:", error);
    return ApiErrors.internal("Failed to edit email");
  }
}

// DELETE /api/dev/delete-all-leads
// Developer-only endpoint to delete all leads from Firestore
// WARNING: This is a destructive operation!

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/db";

export async function DELETE() {
  try {
    // Only allow in development or with explicit confirmation
    // You can add additional auth/checks here if needed
    console.warn("🗑️ DELETE ALL LEADS requested - this is destructive!");

    // Get all leads
    const leadsSnapshot = await adminDb.collection("leads").get();
    const deletedCount = leadsSnapshot.size;

    // Delete all leads in batch
    const batch = adminDb.batch();
    leadsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(`✅ Successfully deleted ${deletedCount} leads`);

    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} leads`,
    });
  } catch (error) {
    console.error("Error deleting all leads:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete leads",
      },
      { status: 500 }
    );
  }
}

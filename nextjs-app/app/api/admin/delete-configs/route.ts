// DELETE /api/admin/delete-configs
// Delete all configuration documents (admin only)

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firestore-admin";
import { invalidateConfigurationCache } from "@/lib/configuration-helpers";

export async function DELETE() {
  try {
    // Get all configurations
    const configurationsSnapshot = await adminDb
      .collection("configurations")
      .get();

    if (configurationsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: "No configurations to delete",
        deleted: 0,
      });
    }

    // Delete all configurations in a batch
    const batch = adminDb.batch();
    configurationsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Invalidate the cache
    invalidateConfigurationCache();

    const deletedCount = configurationsSnapshot.docs.length;
    console.log(`✓ Deleted ${deletedCount} configuration(s)`);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deletedCount} configuration(s)`,
      deleted: deletedCount,
    });
  } catch (error) {
    console.error("Error deleting configurations:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/dev/delete-all-configurations
// Developer-only endpoint to delete all configurations from Firestore
// WARNING: This is a destructive operation!

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firestore-admin";

export async function DELETE() {
  try {
    // Only allow in development or with explicit confirmation
    // You can add additional auth/checks here if needed
    console.warn("🗑️ DELETE ALL CONFIGURATIONS requested - this is destructive!");

    // Get all configurations
    const configurationsSnapshot = await adminDb.collection("configurations").get();
    const deletedCount = configurationsSnapshot.size;

    // Delete all configurations in batch
    const batch = adminDb.batch();
    configurationsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(`✅ Successfully deleted ${deletedCount} configurations`);

    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} configurations`,
    });
  } catch (error) {
    console.error("Error deleting all configurations:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete configurations",
      },
      { status: 500 }
    );
  }
}

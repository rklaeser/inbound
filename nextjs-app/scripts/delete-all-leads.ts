// Script to delete all leads from Firebase
// Run with: npx tsx scripts/delete-all-leads.ts

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore(app);

async function deleteAllLeads() {
  const leadsRef = db.collection("leads");
  const snapshot = await leadsRef.get();

  if (snapshot.empty) {
    console.log("No leads found to delete.");
    return;
  }

  console.log(`Found ${snapshot.size} leads. Deleting...`);

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(`Successfully deleted ${snapshot.size} leads.`);
}

deleteAllLeads()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error deleting leads:", error);
    process.exit(1);
  });

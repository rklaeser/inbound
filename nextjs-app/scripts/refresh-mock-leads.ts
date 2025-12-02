/**
 * Refresh Mock Leads
 *
 * Regenerates mock leads and syncs them to Firestore in one command.
 * Run with: npx tsx scripts/refresh-mock-leads.ts
 *
 * This script:
 * 1. Generates new mock leads (writes to generated-leads.json)
 * 2. Clears all existing mock leads from Firestore (mock_lead_* IDs only)
 * 3. Uploads the new mock leads to Firestore
 */

import * as fs from "fs";
import * as path from "path";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, "../.env.local") });

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

interface Lead {
  id: string;
  submission: {
    leadName: string;
    email: string;
    company: string;
    message: string;
  };
  bot_research: {
    timestamp: string;
    confidence: number;
    classification: string;
    reasoning: string;
    existingCustomer: boolean;
    crmRecordId?: string;
    researchReport: string;
  } | null;
  bot_rollout: {
    rollOut: number;
    useBot: boolean;
  };
  email: {
    text: string;
    createdAt: string;
    editedAt: string;
    lastEditedBy?: string;
  } | null;
  status: {
    status: string;
    received_at: string;
    sent_at: string | null;
    sent_by: string | null;
  };
  classifications: Array<{
    author: string;
    classification: string;
    timestamp: string;
    needs_review?: boolean;
    applied_threshold?: number;
  }>;
  edit_note?: string;
}

function convertDatesToTimestamps(lead: Lead): Record<string, unknown> {
  return {
    ...lead,
    bot_research: lead.bot_research
      ? {
          ...lead.bot_research,
          timestamp: Timestamp.fromDate(new Date(lead.bot_research.timestamp)),
        }
      : null,
    email: lead.email
      ? {
          ...lead.email,
          createdAt: Timestamp.fromDate(new Date(lead.email.createdAt)),
          editedAt: Timestamp.fromDate(new Date(lead.email.editedAt)),
        }
      : null,
    status: {
      ...lead.status,
      received_at: Timestamp.fromDate(new Date(lead.status.received_at)),
      sent_at: lead.status.sent_at
        ? Timestamp.fromDate(new Date(lead.status.sent_at))
        : null,
    },
    classifications: lead.classifications.map((c) => ({
      ...c,
      timestamp: Timestamp.fromDate(new Date(c.timestamp)),
    })),
  };
}

async function clearMockLeads(): Promise<number> {
  console.log("🗑️  Clearing existing mock leads...");

  // Only delete leads with mock_lead_ prefix to preserve real leads
  const leadsSnapshot = await db.collection("leads")
    .where("__name__", ">=", "mock_lead_")
    .where("__name__", "<", "mock_lead_\uf8ff")
    .get();

  const count = leadsSnapshot.size;

  if (count === 0) {
    console.log("   No existing mock leads to clear.");
    return 0;
  }

  // Delete in batches of 500 (Firestore limit)
  const batchSize = 500;
  let deleted = 0;

  while (deleted < count) {
    const batch = db.batch();
    const docs = leadsSnapshot.docs.slice(deleted, deleted + batchSize);

    docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    deleted += docs.length;
  }

  console.log(`   ✓ Cleared ${count} mock leads`);
  return count;
}

async function seedLeads(leads: Lead[]): Promise<void> {
  console.log(`\n📤 Uploading ${leads.length} mock leads to Firestore...`);

  // Upload in batches of 500 (Firestore limit)
  const batchSize = 500;
  let uploaded = 0;

  while (uploaded < leads.length) {
    const batch = db.batch();
    const batchLeads = leads.slice(uploaded, uploaded + batchSize);

    batchLeads.forEach((lead) => {
      const docRef = db.collection("leads").doc(lead.id);
      const data = convertDatesToTimestamps(lead);
      // Remove the id from the data since it's the document ID
      const { id, ...docData } = data as { id: string } & Record<string, unknown>;
      batch.set(docRef, docData);
    });

    await batch.commit();
    uploaded += batchLeads.length;
  }

  console.log(`   ✓ Uploaded ${leads.length} leads`);
}

async function main() {
  console.log("🔄 Refresh Mock Leads");
  console.log("=".repeat(40));

  // Step 1: Generate new mock leads by importing and running the generator
  console.log("\n📝 Generating new mock leads...");

  // Dynamically import and run the generator
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  try {
    await execAsync("npx tsx scripts/generate-mock-leads.ts", {
      cwd: path.join(__dirname, ".."),
    });
    console.log("   ✓ Generated new mock leads");
  } catch (error) {
    console.error("   ❌ Failed to generate mock leads:", error);
    process.exit(1);
  }

  // Step 2: Read the generated leads
  const leadsPath = path.join(__dirname, "../lib/db/generated-leads.json");

  if (!fs.existsSync(leadsPath)) {
    console.error(`\n❌ Error: Generated leads file not found at ${leadsPath}`);
    process.exit(1);
  }

  const leadsJson = fs.readFileSync(leadsPath, "utf-8");
  const leads: Lead[] = JSON.parse(leadsJson);

  // Step 3: Clear existing mock leads (only mock_lead_* IDs)
  await clearMockLeads();

  // Step 4: Upload new leads
  await seedLeads(leads);

  // Print summary
  const statusCounts: Record<string, number> = {};
  const classificationCounts: Record<string, number> = {};

  leads.forEach((lead) => {
    const status = lead.status.status;
    const classification = lead.classifications[0]?.classification || "unclassified";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    classificationCounts[classification] = (classificationCounts[classification] || 0) + 1;
  });

  console.log("\n" + "=".repeat(40));
  console.log("📊 Summary:");
  console.log("\n   By Status:");
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`     ${status}: ${count}`);
  });
  console.log("\n   By Classification:");
  Object.entries(classificationCounts).forEach(([classification, count]) => {
    console.log(`     ${classification}: ${count}`);
  });

  console.log("\n✅ Refresh complete!");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });

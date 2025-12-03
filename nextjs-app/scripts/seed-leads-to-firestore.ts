/**
 * Seed Generated Leads to Firestore
 *
 * This script uploads the generated mock leads to Firestore.
 * Run with: npx tsx scripts/seed-leads-to-firestore.ts
 *
 * Options:
 *   --clear    Delete all existing leads before seeding
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
  meeting_booked_at?: string;
}

function convertDatesToTimestamps(lead: Lead): Record<string, unknown> {
  const result: Record<string, unknown> = {
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

  // Only add meeting_booked_at if it exists (Firestore doesn't accept undefined)
  if (lead.meeting_booked_at) {
    result.meeting_booked_at = Timestamp.fromDate(new Date(lead.meeting_booked_at));
  }

  return result;
}

async function clearExistingLeads(): Promise<number> {
  console.log("Clearing existing leads...");

  const leadsSnapshot = await db.collection("leads").get();
  const count = leadsSnapshot.size;

  if (count === 0) {
    console.log("No existing leads to clear.");
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
    console.log(`  Deleted ${deleted}/${count} leads...`);
  }

  console.log(`✓ Cleared ${count} existing leads`);
  return count;
}

async function seedLeads(leads: Lead[]): Promise<void> {
  console.log(`\nSeeding ${leads.length} leads to Firestore...`);

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
    console.log(`  Uploaded ${uploaded}/${leads.length} leads...`);
  }

  console.log(`✓ Seeded ${leads.length} leads to Firestore`);
}

async function main() {
  const args = process.argv.slice(2);
  const shouldClear = args.includes("--clear");

  console.log("🌱 Lead Seeding Script");
  console.log("=".repeat(40));

  // Read the generated leads
  const leadsPath = path.join(__dirname, "../lib/db/generated-leads.json");

  if (!fs.existsSync(leadsPath)) {
    console.error(`\n❌ Error: Generated leads file not found at ${leadsPath}`);
    console.error("Run 'npx tsx scripts/generate-mock-leads.ts' first.");
    process.exit(1);
  }

  const leadsJson = fs.readFileSync(leadsPath, "utf-8");
  const leads: Lead[] = JSON.parse(leadsJson);

  console.log(`\nFound ${leads.length} leads to seed`);

  // Optionally clear existing leads
  if (shouldClear) {
    await clearExistingLeads();
  }

  // Seed leads
  await seedLeads(leads);

  console.log("\n" + "=".repeat(40));
  console.log("✅ Seeding complete!");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });

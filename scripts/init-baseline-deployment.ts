// Script to create the baseline deployment (v1) from current settings and prompts
// Run this once to initialize the deployment system

import { adminDb } from "../app/lib/firestore-admin";
import { CLASSIFICATION_PROMPT, EMAIL_GENERATION_PROMPT } from "../app/lib/prompts";
import type { Deployment } from "../app/lib/types";

async function initBaselineDeployment() {
  try {
    console.log("Initializing baseline deployment...");

    // Check if any deployments already exist
    const existingDeployments = await adminDb
      .collection("deployments")
      .limit(1)
      .get();

    if (!existingDeployments.empty) {
      console.log("Deployments already exist. Skipping initialization.");
      console.log(`Found ${existingDeployments.size} existing deployment(s)`);
      return;
    }

    // Generate deployment ID
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let deploymentId = 'dpl_';
    for (let i = 0; i < 12; i++) {
      deploymentId += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Create the baseline deployment with current settings
    const baselineDeployment: Omit<Deployment, 'id'> = {
      version: 1,
      name: deploymentId,
      description: undefined,
      status: "active",
      settings: {
        autoRejectConfidenceThreshold: 0.9,
        qualityLeadConfidenceThreshold: 0.7,
      },
      prompts: {
        classification: CLASSIFICATION_PROMPT,
        emailGeneration: EMAIL_GENERATION_PROMPT,
      },
      emailTemplate: {
        greeting: "Hi {firstName},",
        callToAction: "Let's schedule a quick 15-minute call to discuss how Vercel can help.",
      },
      created_by: "system",
      deployed_at: new Date(),
      created_at: new Date(),
      archived_at: null,
    };

    const docRef = adminDb.collection("deployments").doc(deploymentId);
    await docRef.set(baselineDeployment);

    console.log(`✓ Baseline deployment created with ID: ${docRef.id}`);
    console.log(`  Version: v${baselineDeployment.version}`);
    console.log(`  Status: ${baselineDeployment.status}`);
    console.log(`  Settings:`);
    console.log(`    - autoRejectConfidenceThreshold: ${baselineDeployment.settings.autoRejectConfidenceThreshold}`);
    console.log(`    - qualityLeadConfidenceThreshold: ${baselineDeployment.settings.qualityLeadConfidenceThreshold}`);

    // Backfill existing leads with this deployment ID
    console.log("\nBackfilling existing leads with deployment ID...");

    const leadsSnapshot = await adminDb
      .collection("leads")
      .where("deployment_id", "==", null)
      .get();

    if (leadsSnapshot.empty) {
      console.log("No leads to backfill.");
    } else {
      const batch = adminDb.batch();
      let count = 0;

      leadsSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          deployment_id: docRef.id,
          deployment_version: baselineDeployment.version,
        });
        count++;

        // Firestore batches have a limit of 500 operations
        if (count >= 500) {
          console.log(`  Committing batch of ${count} leads...`);
        }
      });

      await batch.commit();
      console.log(`✓ Backfilled ${count} lead(s) with baseline deployment`);
    }

    console.log("\n✓ Baseline deployment initialization complete!");
  } catch (error) {
    console.error("Error initializing baseline deployment:", error);
    process.exit(1);
  }
}

// Run the script
initBaselineDeployment()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

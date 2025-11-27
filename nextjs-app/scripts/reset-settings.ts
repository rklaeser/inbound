// Script to reset/reinitialize settings in Firebase
// Run with: npx tsx scripts/reset-settings.ts

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

// Default prompts
const CLASSIFICATION_PROMPT = `You are a B2B sales qualification expert for Vercel.`;
const EMAIL_GENERATION_PROMPT = `You are writing a personalized sales email for Vercel.`;
const GENERIC_EMAIL_PROMPT = `You are writing a generic thank you email for Vercel.`;
const LOW_VALUE_EMAIL_PROMPT = `You are writing a brief sales email for Vercel.`;

const DEFAULT_CONFIGURATION = {
  thresholds: {
    highQuality: 0.95,
    lowQuality: 0.9,
    support: 0.9,
    duplicate: 0.9,
    irrelevant: 0.85,
  },
  sdr: {
    name: "Ryan",
    email: "ryan@vercel.com",
  },
  emailTemplates: {
    highQuality: {
      subject: "Hi from Vercel",
      greeting: "Hi {firstName},",
      callToAction: "Let's schedule a quick 15-minute call to discuss how Vercel can help.",
      signOff: "Best,",
    },
    lowQuality: {
      subject: "Thanks for your interest in Vercel",
      greeting: "Hi {firstName},",
      callToAction: "Check out [vercel.com/customers](https://vercel.com/customers) to see how companies are using our platform.",
      signOff: "Best,",
      senderName: "The Vercel Team",
      senderEmail: "sales@vercel.com",
    },
    support: {
      subject: "Re: Your Vercel Support Request",
      greeting: "Hi {firstName},",
      callToAction: "Our support team will be in touch shortly. You can also visit [vercel.com/help](https://vercel.com/help) for immediate assistance.",
      signOff: "Best,",
      senderName: "The Vercel Team",
      senderEmail: "support@vercel.com",
    },
    duplicate: {
      subject: "Great to hear from you again!",
      greeting: "Hi {firstName},",
      callToAction: "Your account team has been notified and will reach out to discuss next steps.",
      signOff: "Best,",
      senderName: "The Vercel Team",
      senderEmail: "sales@vercel.com",
    },
  },
  prompts: {
    classification: CLASSIFICATION_PROMPT,
    emailHighQuality: EMAIL_GENERATION_PROMPT,
    emailLowQuality: LOW_VALUE_EMAIL_PROMPT,
    emailGeneric: GENERIC_EMAIL_PROMPT,
  },
  rollout: {
    enabled: false,
    percentage: 0,
  },
  updated_at: new Date(),
  updated_by: "system",
};

async function resetSettings() {
  console.log("Resetting settings/configuration...");

  await db.collection("settings").doc("configuration").set(DEFAULT_CONFIGURATION);

  console.log("Settings reset successfully!");
  console.log("New configuration:", JSON.stringify(DEFAULT_CONFIGURATION, null, 2));
}

resetSettings()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error resetting settings:", error);
    process.exit(1);
  });

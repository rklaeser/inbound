/**
 * Migration script to populate Firebase with case studies from case-studies.ts
 *
 * Run this script once to migrate case studies to Firebase:
 * npx tsx scripts/migrate-case-studies.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { CASE_STUDIES, CaseStudy } from '../app/lib/case-studies';

/**
 * Generate embedding for a case study
 */
async function generateEmbeddingForCaseStudy(caseStudy: CaseStudy): Promise<number[]> {
  const parts: string[] = [];

  parts.push(`Company: ${caseStudy.company}`);
  parts.push(`Industry: ${caseStudy.industry}`);
  parts.push(`Description: ${caseStudy.description}`);

  if (caseStudy.metrics && caseStudy.metrics.length > 0) {
    const metricsText = caseStudy.metrics
      .map(m => `${m.value} ${m.description}`)
      .join(', ');
    parts.push(`Key Results: ${metricsText}`);
  }

  parts.push(`Technologies: ${caseStudy.products.join(', ')}`);

  if (caseStudy.quote) {
    parts.push(`Customer Quote: ${caseStudy.quote}`);
  }

  const text = parts.join('. ');

  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: text,
  });

  return embedding;
}

// Firebase config from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

async function migrateCaseStudies() {
  console.log('🚀 Starting case studies migration...\n');

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const caseStudiesRef = collection(db, 'case_studies');

  let successCount = 0;
  let errorCount = 0;

  for (const caseStudy of CASE_STUDIES) {
    try {
      const { id, ...data } = caseStudy;

      console.log(`  Generating embedding for ${caseStudy.company}...`);
      const embedding = await generateEmbeddingForCaseStudy(caseStudy);

      const docData = {
        ...data,
        embedding,
        embedding_model: 'text-embedding-3-small',
        embedding_generated_at: Timestamp.now(),
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      };

      const docRef = await addDoc(caseStudiesRef, docData);

      console.log(`✓ Migrated: ${caseStudy.company} (ID: ${docRef.id})`);
      successCount++;
    } catch (error) {
      console.error(`✗ Failed to migrate ${caseStudy.company}:`, error);
      errorCount++;
    }
  }

  console.log(`\n✅ Migration complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total: ${CASE_STUDIES.length}`);

  process.exit(0);
}

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../app/.env.local') });

migrateCaseStudies().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});

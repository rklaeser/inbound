import { NextResponse } from 'next/server';
import { createCaseStudy } from '@/lib/firebase-case-studies';
import { CASE_STUDIES } from '@/lib/case-studies';

/**
 * POST /api/migrate-case-studies
 * Migrates all case studies from the TypeScript file to Firebase with embeddings
 */
export async function POST() {
  try {
    console.log('🚀 Starting case studies migration...\n');

    const results = {
      success: [] as string[],
      errors: [] as { company: string; error: string }[],
    };

    for (const caseStudy of CASE_STUDIES) {
      try {
        const { id, ...data } = caseStudy;

        console.log(`  Migrating: ${caseStudy.company}...`);

        const docId = await createCaseStudy(data);

        console.log(`✓ Migrated: ${caseStudy.company} (ID: ${docId})`);
        results.success.push(caseStudy.company);
      } catch (error) {
        console.error(`✗ Failed to migrate ${caseStudy.company}:`, error);
        results.errors.push({
          company: caseStudy.company,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Success: ${results.success.length}`);
    console.log(`   Errors: ${results.errors.length}`);
    console.log(`   Total: ${CASE_STUDIES.length}`);

    return NextResponse.json({
      success: true,
      data: {
        migrated: results.success.length,
        failed: results.errors.length,
        total: CASE_STUDIES.length,
        results,
      },
    });
  } catch (error) {
    console.error('Migration failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Migration failed',
      },
      { status: 500 }
    );
  }
}

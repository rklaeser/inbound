import { NextResponse } from 'next/server';
import { getAllCaseStudies, updateCaseStudy } from '@/lib/firebase-case-studies';

/**
 * POST /api/dev/migrate-featured-text
 * Adds placeholder featuredText to case studies that don't have it
 */
export async function POST() {
  try {
    console.log('[Migration] Starting featuredText migration...');

    const caseStudies = await getAllCaseStudies();
    const results = {
      updated: [] as string[],
      skipped: [] as string[],
    };

    for (const cs of caseStudies) {
      // Skip if already has featuredText
      if (cs.featuredText) {
        results.skipped.push(cs.company);
        continue;
      }

      // Add placeholder featuredText
      console.log(`[Migration] Adding placeholder featuredText to ${cs.company}...`);
      await updateCaseStudy(cs.id, {
        featuredText: '[Edit featured text]',
      });
      results.updated.push(cs.company);
    }

    console.log(`[Migration] Complete! Updated: ${results.updated.length}, Skipped: ${results.skipped.length}`);

    return NextResponse.json({
      success: true,
      data: {
        updated: results.updated.length,
        skipped: results.skipped.length,
        results,
      },
    });
  } catch (error) {
    console.error('[Migration] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Migration failed',
      },
      { status: 500 }
    );
  }
}

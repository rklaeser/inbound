import CaseStudies from '@/components/dashboard/CaseStudies';
import { getAllCaseStudiesServer } from '@/lib/db';
import { getConfiguration } from '@/lib/configuration-helpers';

// Cache for 60 seconds - serves cached data instantly, revalidates in background
export const revalidate = 60;

export default async function CaseStudiesPage() {
  // Fetch on server - cached by Next.js
  const [caseStudies, configuration] = await Promise.all([
    getAllCaseStudiesServer(),
    getConfiguration().catch(() => null),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-1">Case Studies</h2>
        <p className="text-sm text-muted-foreground">
          Manage customer success stories for lead matching
        </p>
      </div>
      <CaseStudies
        initialCaseStudies={caseStudies}
        initialDefaultCaseStudyId={configuration?.defaultCaseStudyId ?? null}
      />
    </div>
  );
}

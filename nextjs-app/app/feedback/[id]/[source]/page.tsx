import { getLeadByIdServer } from '@/lib/db';
import { notFound } from 'next/navigation';
import FeedbackForm from './FeedbackForm';

export type FeedbackSource = 'customer' | 'support' | 'sales';

interface FeedbackPageProps {
  params: Promise<{ id: string; source: string }>;
  searchParams: Promise<{ withNote?: string; selfService?: string }>;
}

const config: Record<FeedbackSource, { title: string; subtitle: string; accent: string }> = {
  customer: {
    title: 'Tell us more',
    subtitle: 'Help us better understand your request',
    accent: 'rgba(0, 112, 243, 0.03)',
  },
  support: {
    title: 'Send Back to SDR',
    subtitle: 'This lead will be sent back to the classify queue for re-evaluation',
    accent: 'rgba(236, 72, 153, 0.03)',
  },
  sales: {
    title: 'Send Back to SDR',
    subtitle: 'This lead will be sent back to the classify queue for re-evaluation',
    accent: 'rgba(236, 72, 153, 0.03)',
  },
};

export default async function FeedbackPage({ params, searchParams }: FeedbackPageProps) {
  const { id, source } = await params;
  const { withNote, selfService } = await searchParams;

  // Validate source
  if (!['customer', 'support', 'sales'].includes(source)) {
    notFound();
  }

  const feedbackSource = source as FeedbackSource;
  const lead = await getLeadByIdServer(id);

  if (!lead) {
    notFound();
  }

  const cfg = config[feedbackSource];
  const showNoteField = feedbackSource === 'customer' || withNote === 'true';
  const isSelfService = feedbackSource === 'support' && selfService === 'true';

  // Self-service has different UI
  const title = isSelfService ? 'Mark as Self-Service' : cfg.title;
  const subtitle = isSelfService
    ? 'Let us know that no support response was needed for this lead'
    : cfg.subtitle;
  const accent = isSelfService ? 'rgba(59, 130, 246, 0.03)' : cfg.accent;

  return (
    <div className="min-h-screen" style={{ background: 'var(--background-primary)' }}>
      {/* Background decoration */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 0%, ${accent} 0%, transparent 50%)` }}
      />

      <main className="relative container mx-auto px-4 py-16 sm:py-24">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1
              className="text-3xl sm:text-4xl font-semibold mb-4"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            >
              {title}
            </h1>
            <p
              className="text-base sm:text-lg"
              style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}
            >
              {subtitle}
            </p>
          </div>

          {/* Form Card */}
          <div
            className="rounded-lg border p-8 sm:p-10"
            style={{ background: 'var(--background-secondary)', borderColor: 'var(--border)' }}
          >
            <FeedbackForm
              leadId={lead.id}
              source={feedbackSource}
              originalMessage={lead.submission.message}
              firstName={lead.submission.leadName.split(' ')[0]}
              company={lead.submission.company}
              showNoteField={showNoteField}
              isSelfService={isSelfService}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

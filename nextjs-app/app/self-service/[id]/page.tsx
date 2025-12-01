import { getLeadByIdServer } from '@/lib/firestore-server';
import { notFound } from 'next/navigation';
import SelfServiceForm from './SelfServiceForm';

interface SelfServicePageProps {
  params: Promise<{ id: string }>;
}

export default async function SelfServicePage({ params }: SelfServicePageProps) {
  const { id } = await params;
  const lead = await getLeadByIdServer(id);

  if (!lead) {
    notFound();
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background-primary)' }}>
      {/* Background decoration */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.03) 0%, transparent 50%)',
        }}
      />

      <main className="relative container mx-auto px-4 py-16 sm:py-24">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1
              className="text-3xl sm:text-4xl font-semibold mb-4"
              style={{
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}
            >
              Mark as Self-Service
            </h1>
            <p
              className="text-base sm:text-lg"
              style={{
                color: 'var(--text-secondary)',
                lineHeight: '1.6',
              }}
            >
              Let us know that no support response was needed for this lead
            </p>
          </div>

          {/* Form Card */}
          <div
            className="rounded-lg border p-8 sm:p-10"
            style={{
              background: 'var(--background-secondary)',
              borderColor: 'var(--border)',
            }}
          >
            <SelfServiceForm
              leadId={lead.id}
              company={lead.submission.company}
              originalMessage={lead.submission.message}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

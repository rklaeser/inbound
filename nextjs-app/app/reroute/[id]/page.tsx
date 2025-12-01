import { getLeadByIdServer } from '@/lib/firestore-server';
import { notFound } from 'next/navigation';
import RerouteForm from './RerouteForm';

interface ReroutePageProps {
  params: Promise<{ id: string }>;
}

export default async function ReroutePage({ params }: ReroutePageProps) {
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
          background: 'radial-gradient(circle at 50% 0%, rgba(0, 112, 243, 0.03) 0%, transparent 50%)',
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
              Tell us more
            </h1>
            <p
              className="text-base sm:text-lg"
              style={{
                color: 'var(--text-secondary)',
                lineHeight: '1.6',
              }}
            >
              Help us better understand your request
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
            <RerouteForm
              leadId={lead.id}
              originalMessage={lead.submission.message}
              firstName={lead.submission.leadName.split(' ')[0]}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

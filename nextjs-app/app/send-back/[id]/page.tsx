import { getLeadByIdServer } from '@/lib/firestore-server';
import { notFound } from 'next/navigation';
import SendBackForm from './SendBackForm';

interface SendBackPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ team?: string; withNote?: string }>;
}

export default async function SendBackPage({ params, searchParams }: SendBackPageProps) {
  const { id } = await params;
  const { team, withNote } = await searchParams;
  const lead = await getLeadByIdServer(id);

  if (!lead) {
    notFound();
  }

  // Validate team parameter
  const validTeam = team === 'support' || team === 'account' ? team : 'support';
  const showNoteField = withNote === 'true';

  return (
    <div className="min-h-screen" style={{ background: 'var(--background-primary)' }}>
      {/* Background decoration */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 0%, rgba(236, 72, 153, 0.03) 0%, transparent 50%)',
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
              Send Back to SDR
            </h1>
            <p
              className="text-base sm:text-lg"
              style={{
                color: 'var(--text-secondary)',
                lineHeight: '1.6',
              }}
            >
              This lead will be sent back to the classify queue for re-evaluation
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
            <SendBackForm
              leadId={lead.id}
              team={validTeam}
              showNoteField={showNoteField}
              company={lead.submission.company}
              originalMessage={lead.submission.message}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

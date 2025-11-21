'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { VercelLogo } from '@/components/ui/vercel-logo';
import { Button } from '@/components/ui/button';

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  final_email_subject: string | null;
  final_email_body: string | null;
  generated_email_subject: string | null;
  generated_email_body: string | null;
  status: string;
  meeting_booked_at: any;
}

export default function SentEmailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.leadId as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLead() {
      try {
        const response = await fetch(`/api/leads/${leadId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch lead');
        }
        const data = await response.json();
        setLead(data);
        setBooked(!!data.meeting_booked_at);
      } catch (err) {
        setError('Email not found');
        console.error('Error fetching lead:', err);
      } finally {
        setLoading(false);
      }
    }

    if (leadId) {
      fetchLead();
    }
  }, [leadId]);

  const handleBookMeeting = async () => {
    if (!lead || booked) return;

    setBooking(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/book-meeting`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to book meeting');
      }

      setBooked(true);
    } catch (err) {
      console.error('Error booking meeting:', err);
      alert('Failed to book meeting. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background-primary)' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background-primary)' }}>
        <div style={{ color: 'var(--text-secondary)' }}>{error || 'Email not found'}</div>
      </div>
    );
  }

  const emailSubject = lead.final_email_subject || lead.generated_email_subject || 'No subject';
  const emailBody = lead.final_email_body || lead.generated_email_body || 'No content';

  return (
    <div className="min-h-screen" style={{ background: 'var(--background-primary)' }}>
      {/* Background decoration */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 0%, rgba(0, 112, 243, 0.03) 0%, transparent 50%)',
        }}
      />

      {/* Header Bar */}
      <div className="absolute top-0 left-0 right-0 p-6 z-10 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <VercelLogo height={20} />
          <span className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
            Vercel Sales
          </span>
        </div>
      </div>

      <main className="relative container mx-auto px-4 py-24 sm:py-32">
        <div className="max-w-3xl mx-auto">
          {/* Email Container */}
          <div
            className="rounded-lg border overflow-hidden"
            style={{
              background: 'var(--background-secondary)',
              borderColor: 'var(--border)',
            }}
          >
            {/* Email Header */}
            <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="mb-4">
                <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                  From: Vercel Sales Team
                </div>
                <div className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                  To: {lead.email}
                </div>
              </div>
              <h1
                className="text-2xl sm:text-3xl font-semibold"
                style={{
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                }}
              >
                {emailSubject}
              </h1>
            </div>

            {/* Email Body */}
            <div className="p-6">
              <div
                className="prose prose-sm sm:prose-base max-w-none"
                style={{
                  color: 'var(--text-primary)',
                }}
              >
                {emailBody.split('\n').map((paragraph, index) => (
                  <p key={index} className="mb-4" style={{ color: 'var(--text-primary)' }}>
                    {paragraph}
                  </p>
                ))}
              </div>

              {/* Booking CTA */}
              <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
                {booked ? (
                  <div
                    className="p-4 rounded-md border text-center"
                    style={{
                      background: 'rgba(0, 200, 0, 0.05)',
                      borderColor: 'rgba(0, 200, 0, 0.2)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <div className="text-lg font-medium mb-1">Meeting Booked!</div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Thank you for scheduling a meeting with us. We'll be in touch shortly.
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>
                      Ready to discuss how Vercel can help {lead.company}?
                    </p>
                    <Button
                      onClick={handleBookMeeting}
                      disabled={booking}
                      className="px-8 py-3 text-base font-medium"
                      style={{
                        background: 'var(--blue)',
                        color: '#000',
                      }}
                    >
                      {booking ? 'Booking...' : 'Book a Meeting'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            This is a simulated email display for demo purposes
          </div>
        </div>
      </main>
    </div>
  );
}

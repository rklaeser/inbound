'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { VercelLogo } from '@/components/ui/vercel-logo';
import { Button } from '@/components/ui/button';

export default function BookMeetingPage() {
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        const response = await fetch(`/api/leads/${id}`);
        if (!response.ok) {
          throw new Error('Not found');
        }
        const data = await response.json();
        setBooked(!!data.meeting_booked_at);
      } catch (err) {
        setError('Link not found');
        console.error('Error fetching lead:', err);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      checkStatus();
    }
  }, [id]);

  const handleBookMeeting = async () => {
    if (booked) return;

    setBooking(true);
    try {
      const response = await fetch(`/api/leads/${id}/book-meeting`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to book meeting');
      }

      setBooked(true);
    } catch (err) {
      console.error('Error booking meeting:', err);
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background decoration */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 0%, rgba(0, 112, 243, 0.03) 0%, transparent 50%)',
        }}
      />

      {/* Header Bar */}
      <div className="absolute top-0 left-0 right-0 p-6 z-10 border-b border-border">
        <div className="flex items-center gap-2">
          <VercelLogo height={20} />
          <span className="text-base font-medium text-foreground">
            Vercel Sales
          </span>
        </div>
      </div>

      <main className="relative container mx-auto px-4 py-24 sm:py-32">
        <div className="max-w-md mx-auto text-center">
          {booked ? (
            <div>
              {/* Success Icon */}
              <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-green-500/10 border border-green-500/30">
                <svg
                  className="w-10 h-10 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold mb-3 text-foreground tracking-tight">
                Meeting Booked!
              </h1>
              <p className="text-muted-foreground leading-relaxed">
                Thank you for scheduling a meeting with us. We'll be in touch shortly.
              </p>
            </div>
          ) : (
            <div>
              {/* Calendar Icon */}
              <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-blue-500/10 border border-blue-500/30">
                <svg
                  className="w-10 h-10 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold mb-3 text-foreground tracking-tight">
                Let's Talk
              </h1>
              <p className="mb-8 text-muted-foreground leading-relaxed">
                Ready to learn how Vercel can help your team ship faster?
              </p>
              <Button
                onClick={handleBookMeeting}
                disabled={booking}
                variant="info"
                className="px-8 py-3 text-base font-medium"
              >
                {booking ? 'Booking...' : 'Book a Meeting'}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

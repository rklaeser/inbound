'use client';

import { useState, useEffect } from 'react';
import { VercelLogo } from '@/components/ui/vercel-logo';
import LeadForm from '@/components/customer/LeadForm';
import SuccessMessage from '@/components/customer/SuccessMessage';

export default function CustomerPage() {
  const [showSuccess, setShowSuccess] = useState(false);
  const [submittedLead, setSubmittedLead] = useState<{ company: string; message: string } | null>(null);
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  const isDevModeAvailable = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

  // Load dev mode state from localStorage
  useEffect(() => {
    if (isDevModeAvailable) {
      const stored = localStorage.getItem('devMode');
      setDevModeEnabled(stored === 'true');
    }
  }, [isDevModeAvailable]);

  const toggleDevMode = () => {
    const newValue = !devModeEnabled;
    setDevModeEnabled(newValue);
    localStorage.setItem('devMode', String(newValue));
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--background-primary)' }}>
      {/* Background decoration - subtle gradient */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 0%, rgba(0, 112, 243, 0.03) 0%, transparent 50%)',
        }}
      />

      {/* Header Bar */}
      <div className="absolute top-0 left-0 right-0 p-6 z-10">
        <div className="flex items-center justify-between">
          {/* Vercel Branding */}
          <div className="flex items-center gap-2">
            <VercelLogo height={20} />
            <span className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
              Vercel
            </span>
          </div>

          {/* Dev Mode Toggle */}
          {isDevModeAvailable && (
            <button
              onClick={toggleDevMode}
              className="px-4 py-2 rounded-md border text-sm font-medium transition-all duration-150"
              style={{
                background: devModeEnabled ? 'var(--blue)' : 'transparent',
                borderColor: devModeEnabled ? 'var(--blue)' : 'var(--border-custom)',
                color: devModeEnabled ? '#000' : 'var(--text-secondary)',
              }}
            >
              {devModeEnabled ? '● Dev Mode ON' : '○ Dev Mode OFF'}
            </button>
          )}
        </div>
      </div>

      <main className="relative container mx-auto px-4 py-16 sm:py-24">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1
              className="text-4xl sm:text-5xl font-semibold mb-4"
              style={{
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}
            >
              Talk to our Sales team
            </h1>
            <p
              className="text-base sm:text-lg"
              style={{
                color: 'var(--text-secondary)',
                lineHeight: '1.6',
              }}
            >
              Discover the value of Vercel
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
            {showSuccess ? (
              <SuccessMessage
                onReset={() => {
                  setShowSuccess(false);
                  setSubmittedLead(null);
                }}
                leadData={submittedLead || undefined}
                devModeEnabled={devModeEnabled}
              />
            ) : (
              <LeadForm
                onSuccess={(leadData) => {
                  setSubmittedLead(leadData);
                  setShowSuccess(true);
                }}
                devModeEnabled={devModeEnabled}
              />
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

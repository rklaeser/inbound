'use client';

import { useState, useEffect } from 'react';
import { VercelLogo } from '@/components/ui/vercel-logo';
import LeadForm from '@/components/customer/LeadForm';
import SuccessMessage from '@/components/customer/SuccessMessage';
import { Button } from '@/components/ui/button';

export default function CustomerPage() {
  const [showSuccess, setShowSuccess] = useState(false);
  const [submittedLeadId, setSubmittedLeadId] = useState<string | null>(null);
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
    <div className="min-h-screen bg-background">
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
          <a
            href="/"
            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
          >
            <VercelLogo height={20} />
            <span className="text-base font-medium text-foreground">
              Vercel
            </span>
          </a>

          {/* Header Actions */}
          <div className="flex items-center gap-3">
            {/* Dashboard Button */}
            <Button asChild variant="outline" size="sm">
              <a href="/dashboard">SDR Dashboard</a>
            </Button>

            {/* Dev Mode Toggle */}
            {isDevModeAvailable && (
              <Button
                onClick={toggleDevMode}
                variant={devModeEnabled ? 'info' : 'outline'}
                size="sm"
              >
                {devModeEnabled ? '● Dev Mode ON' : '○ Dev Mode OFF'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <main className="relative container mx-auto px-4 py-16 sm:py-24">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-semibold mb-4 text-foreground tracking-tight">
              Talk to our Sales team
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              Discover the value of Vercel
            </p>
          </div>

          {/* Form Card */}
          <div className="rounded-lg border border-border p-8 sm:p-10 bg-card">
            {showSuccess ? (
              <SuccessMessage
                leadId={submittedLeadId || undefined}
                devModeEnabled={devModeEnabled}
              />
            ) : (
              <LeadForm
                onSuccess={(leadData) => {
                  setSubmittedLeadId(leadData.leadId);
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

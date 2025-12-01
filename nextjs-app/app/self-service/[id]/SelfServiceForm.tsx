'use client';

import { useState } from 'react';

interface SelfServiceFormProps {
  leadId: string;
  company: string;
  originalMessage: string;
}

export default function SelfServiceForm({
  leadId,
  company,
  originalMessage,
}: SelfServiceFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${leadId}/self-service`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit');
      }

      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="text-center py-8">
        <div
          className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(34, 197, 94, 0.1)' }}
        >
          <svg
            className="w-8 h-8"
            style={{ color: '#22c55e' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2
          className="text-xl font-semibold mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          Feedback Recorded
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Thanks! This helps us improve our routing.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Lead Context */}
      <div className="mb-6">
        <label
          className="block text-sm font-medium mb-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          Lead from {company}
        </label>
        <div
          className="p-4 rounded-md text-sm"
          style={{
            background: 'var(--background-primary)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            maxHeight: '150px',
            overflowY: 'auto',
          }}
        >
          {originalMessage}
        </div>
      </div>

      {/* Info Box */}
      <div
        className="mb-6 p-4 rounded-md"
        style={{
          background: 'rgba(59, 130, 246, 0.05)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
        }}
      >
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          This marks the lead as <strong style={{ color: '#3b82f6' }}>self-service</strong> - meaning no support response was needed because the automated email was sufficient.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="mb-6 p-4 rounded-md text-sm"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
          }}
        >
          {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 px-4 rounded-md text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: '#3b82f6',
          color: '#fff',
        }}
      >
        {isSubmitting ? 'Recording...' : 'Mark as Self-Service'}
      </button>
    </form>
  );
}

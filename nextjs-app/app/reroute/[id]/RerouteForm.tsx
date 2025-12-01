'use client';

import { useState } from 'react';

interface RerouteFormProps {
  leadId: string;
  originalMessage: string;
  firstName: string;
}

export default function RerouteForm({ leadId, originalMessage, firstName }: RerouteFormProps) {
  const [additionalContext, setAdditionalContext] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${leadId}/reroute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ additionalContext }),
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
          Thanks, {firstName}!
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          We&apos;ve received your additional information. Our team will review it and get back to you soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Original Message - Read Only */}
      <div className="mb-6">
        <label
          className="block text-sm font-medium mb-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          Your original request
        </label>
        <div
          className="p-4 rounded-md text-sm"
          style={{
            background: 'var(--background-primary)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          {originalMessage}
        </div>
      </div>

      {/* Additional Context */}
      <div className="mb-6">
        <label
          htmlFor="additionalContext"
          className="block text-sm font-medium mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          Tell us more about what you&apos;re looking for
        </label>
        <textarea
          id="additionalContext"
          name="additionalContext"
          rows={5}
          value={additionalContext}
          onChange={(e) => setAdditionalContext(e.target.value)}
          placeholder="Please provide any additional context that would help us understand your needs..."
          className="w-full px-4 py-3 rounded-md text-sm transition-all duration-150 focus:outline-none focus:ring-2"
          style={{
            background: 'var(--background-primary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
          required
        />
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
        disabled={isSubmitting || !additionalContext.trim()}
        className="w-full py-3 px-4 rounded-md text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: 'var(--text-primary)',
          color: 'var(--background-primary)',
        }}
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}

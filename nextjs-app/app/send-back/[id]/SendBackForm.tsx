'use client';

import { useState } from 'react';

interface SendBackFormProps {
  leadId: string;
  team: 'support' | 'account';
  showNoteField: boolean;
  company: string;
  originalMessage: string;
}

export default function SendBackForm({
  leadId,
  team,
  showNoteField,
  company,
  originalMessage,
}: SendBackFormProps) {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamLabel = team === 'support' ? 'Support Team' : 'Account Team';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${leadId}/send-back`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          team,
          note: showNoteField ? note : undefined,
        }),
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
          style={{ background: 'rgba(236, 72, 153, 0.1)' }}
        >
          <svg
            className="w-8 h-8"
            style={{ color: '#ec4899' }}
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
          Lead Sent Back
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          The lead has been returned to the SDR team for re-classification.
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

      {/* Team Info */}
      <div
        className="mb-6 p-4 rounded-md"
        style={{
          background: 'rgba(236, 72, 153, 0.05)',
          border: '1px solid rgba(236, 72, 153, 0.2)',
        }}
      >
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Sending back from: <strong style={{ color: '#ec4899' }}>{teamLabel}</strong>
        </p>
      </div>

      {/* Note Field - Only show if withNote=true */}
      {showNoteField && (
        <div className="mb-6">
          <label
            htmlFor="note"
            className="block text-sm font-medium mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            Why is this not a {team === 'support' ? 'support request' : 'duplicate'}?
          </label>
          <textarea
            id="note"
            name="note"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Provide context to help the SDR team reclassify this lead..."
            className="w-full px-4 py-3 rounded-md text-sm transition-all duration-150 focus:outline-none focus:ring-2"
            style={{
              background: 'var(--background-primary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      )}

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
          background: '#ec4899',
          color: '#fff',
        }}
      >
        {isSubmitting ? 'Sending back...' : 'Send Back to SDR'}
      </button>
    </form>
  );
}

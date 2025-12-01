'use client';

import { useActionState } from 'react';
import { submitFeedback, type FeedbackState } from './actions';
import type { FeedbackSource } from './page';

interface FeedbackFormProps {
  leadId: string;
  source: FeedbackSource;
  originalMessage: string;
  firstName: string;
  company: string;
  showNoteField: boolean;
  isSelfService: boolean;
}

const sourceConfig = {
  customer: {
    color: '#22c55e',
    successTitle: (firstName: string) => `Thanks, ${firstName}!`,
    successMessage: "We've received your additional information. Our team will review it and get back to you soon.",
    submitLabel: 'Submit',
    submittingLabel: 'Submitting...',
  },
  support: {
    color: '#ec4899',
    successTitle: () => 'Lead Sent Back',
    successMessage: 'The lead has been returned to the SDR team for re-classification.',
    submitLabel: 'Send Back to SDR',
    submittingLabel: 'Sending back...',
  },
  sales: {
    color: '#ec4899',
    successTitle: () => 'Lead Sent Back',
    successMessage: 'The lead has been returned to the SDR team for re-classification.',
    submitLabel: 'Send Back to SDR',
    submittingLabel: 'Sending back...',
  },
};

const selfServiceConfig = {
  color: '#3b82f6',
  successTitle: () => 'Feedback Recorded',
  successMessage: 'Thanks! This helps us improve our routing.',
  submitLabel: 'Mark as Self-Service',
  submittingLabel: 'Recording...',
};

export default function FeedbackForm({
  leadId,
  source,
  originalMessage,
  firstName,
  company,
  showNoteField,
  isSelfService,
}: FeedbackFormProps) {
  const [state, action, isPending] = useActionState<FeedbackState | null, FormData>(
    submitFeedback.bind(null, leadId),
    null
  );

  const cfg = isSelfService ? selfServiceConfig : sourceConfig[source];
  const isReasonRequired = source === 'customer';

  if (state?.success) {
    return (
      <div className="text-center py-8">
        <div
          className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
          style={{ background: `${cfg.color}1a` }}
        >
          <svg
            className="w-8 h-8"
            style={{ color: cfg.color }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          {cfg.successTitle(firstName)}
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>{cfg.successMessage}</p>
      </div>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="selfService" value={String(isSelfService)} />

      {/* Original Message / Lead Context */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
          {source === 'customer' ? 'Your original request' : `Lead from ${company}`}
        </label>
        <div
          className="p-4 rounded-md text-sm"
          style={{
            background: 'var(--background-primary)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            maxHeight: source !== 'customer' ? '150px' : undefined,
            overflowY: source !== 'customer' ? 'auto' : undefined,
          }}
        >
          {originalMessage}
        </div>
      </div>

      {/* Self-service info box */}
      {isSelfService && (
        <div
          className="mb-6 p-4 rounded-md"
          style={{
            background: 'rgba(59, 130, 246, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            This marks the lead as <strong style={{ color: '#3b82f6' }}>self-service</strong> - meaning
            no support response was needed because the automated email was sufficient.
          </p>
        </div>
      )}

      {/* Source info box for support/sales (non-self-service) */}
      {!isSelfService && source !== 'customer' && (
        <div
          className="mb-6 p-4 rounded-md"
          style={{
            background: 'rgba(236, 72, 153, 0.05)',
            border: '1px solid rgba(236, 72, 153, 0.2)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Sending back from:{' '}
            <strong style={{ color: '#ec4899' }}>
              {source === 'support' ? 'Support Team' : 'Sales Team'}
            </strong>
          </p>
        </div>
      )}

      {/* Reason field */}
      {showNoteField && !isSelfService && (
        <div className="mb-6">
          <label
            htmlFor="reason"
            className="block text-sm font-medium mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            {source === 'customer'
              ? "Tell us more about what you're looking for"
              : 'Why are you sending this back?'}
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={source === 'customer' ? 5 : 4}
            placeholder={
              source === 'customer'
                ? 'Please provide any additional context that would help us understand your needs...'
                : 'Provide context to help the SDR team reclassify this lead...'
            }
            className="w-full px-4 py-3 rounded-md text-sm transition-all duration-150 focus:outline-none focus:ring-2"
            style={{
              background: 'var(--background-primary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            required={isReasonRequired}
            disabled={isPending}
          />
        </div>
      )}

      {/* Error Message */}
      {state?.error && (
        <div
          className="mb-6 p-4 rounded-md text-sm"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
          }}
        >
          {state.error}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3 px-4 rounded-md text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: source === 'customer' && !isSelfService ? 'var(--text-primary)' : cfg.color,
          color: source === 'customer' && !isSelfService ? 'var(--background-primary)' : '#fff',
        }}
      >
        {isPending ? cfg.submittingLabel : cfg.submitLabel}
      </button>
    </form>
  );
}

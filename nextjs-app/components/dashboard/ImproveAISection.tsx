'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface ImproveAISectionProps {
  leadId: string;
  createdBy: string;
}

export function ImproveAISection({ leadId, createdBy }: ImproveAISectionProps) {
  const [reasoning, setReasoning] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reasoning.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/examples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          sdr_reasoning: reasoning.trim(),
          created_by: createdBy,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSubmitted(true);
      } else {
        setError(result.error || 'Failed to submit example');
      }
    } catch (err) {
      setError('Failed to submit example');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        className="bg-card border border-border rounded-md p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <h2
            className="font-sans text-foreground"
            style={{
              fontSize: '14px',
              fontWeight: 600,
              lineHeight: '28px',
            }}
          >
            Improve our AI
          </h2>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md"
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
              color: '#22c55e',
              border: '1px solid rgba(34, 197, 94, 0.3)',
            }}
          >
            <Check className="h-3.5 w-3.5" />
            <span style={{ fontSize: '12px', fontWeight: 500 }}>Submitted</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Thanks! Your example has been submitted for review.
        </p>
      </div>
    );
  }

  return (
    <div
      className="bg-card border border-border rounded-md p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h2
          className="font-sans text-foreground"
          style={{
            fontSize: '14px',
            fontWeight: 600,
            lineHeight: '28px',
          }}
        >
          Improve our AI
        </h2>
      </div>

      <p className="text-sm text-muted-foreground mb-3">
        Help train our AI by explaining why this classification is correct. Good examples include specific signals from the message or research that justify the classification.
      </p>

      <textarea
        value={reasoning}
        onChange={(e) => setReasoning(e.target.value)}
        placeholder="e.g., 'This is high-quality because the lead is a VP at a Series B company asking about enterprise pricing - clear buying signals.'"
        className="w-full min-h-[80px] p-3 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        disabled={isSubmitting}
      />

      {error && (
        <p className="text-sm text-red-500 mt-2">{error}</p>
      )}

      <div className="flex justify-end mt-3">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !reasoning.trim()}
          size="sm"
          variant="secondary"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Example'}
        </Button>
      </div>
    </div>
  );
}

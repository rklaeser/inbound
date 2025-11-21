'use client';

import { useEffect, useState } from 'react';
import { findRelevantCaseStudiesWithReason } from '@/lib/case-study-matcher';
import type { CaseStudy } from '@/lib/case-studies';

interface SuccessMessageProps {
  onReset?: () => void;
  leadData?: {
    company: string;
    message: string;
  };
  devModeEnabled?: boolean;
}

export default function SuccessMessage({ onReset, leadData, devModeEnabled }: SuccessMessageProps) {
  const [relevantCaseStudy, setRelevantCaseStudy] = useState<CaseStudy | null>(null);
  const [matchReason, setMatchReason] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchRelevantCaseStudy() {
      if (!leadData) {
        setRelevantCaseStudy(null);
        setMatchReason('');
        return;
      }

      setIsLoading(true);

      try {
        // Call server-side API for vector-based matching
        const response = await fetch('/api/case-studies/match', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            company: leadData.company,
            message: leadData.message,
            maxResults: 1,
          }),
        });

        const result = await response.json();

        if (result.success && result.data?.[0]) {
          setRelevantCaseStudy(result.data[0].caseStudy);
          setMatchReason(result.data[0].matchReason);
        } else if (result.success && result.data?.length === 0) {
          // No matches above threshold - don't show a case study
          console.log('No case studies matched above similarity threshold');
          setRelevantCaseStudy(null);
          setMatchReason('No strong match found');
        } else {
          throw new Error(result.error || 'Failed to fetch case studies');
        }
      } catch (error) {
        console.error('Vector matching failed:', error);
        // On error, don't show a case study
        setRelevantCaseStudy(null);
        setMatchReason('');
      } finally {
        setIsLoading(false);
      }
    }

    fetchRelevantCaseStudy();
  }, [leadData]);
  return (
    <div
      className="rounded-md border p-8 text-center"
      style={{
        background: 'var(--background-secondary)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Success Icon */}
      <div
        className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{
          background: 'rgba(0, 170, 0, 0.1)',
          border: '1px solid var(--green)',
        }}
      >
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="var(--green)"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      {/* Success Heading */}
      <h2
        className="text-2xl font-semibold mb-2"
        style={{ color: 'var(--text-primary)' }}
      >
        Thank You!
      </h2>

      {/* Success Message */}
      <p
        className="text-base mb-6"
        style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}
      >
        Your inquiry has been submitted successfully. Our team will review it and
        get back to you shortly with a personalized response.
      </p>

      {/* Case Study Section - Loading State */}
      {isLoading && leadData && (
        <div
          className="mt-8 mb-6 p-6 rounded-md border text-center"
          style={{
            background: 'var(--background-primary)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                style={{ stroke: 'var(--text-secondary)' }}
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                style={{ fill: 'var(--text-primary)' }}
              />
            </svg>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Finding relevant customer story...
            </span>
          </div>
        </div>
      )}

      {/* Case Study Section */}
      {!isLoading && relevantCaseStudy && (
        <div
          className="mt-8 mb-6 p-6 rounded-md border text-left"
          style={{
            background: 'var(--background-primary)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="mb-3">
            <p
              className="text-xs font-medium uppercase tracking-wider mb-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              Customer Success Story
            </p>
            <h3
              className="text-lg font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {relevantCaseStudy.company}
            </h3>
            <p
              className="text-sm mt-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              {relevantCaseStudy.industry}
            </p>
          </div>

          {/* Dev Mode: Match Reason */}
          {devModeEnabled && matchReason && (
            <div
              className="mb-4 p-3 rounded text-xs font-mono"
              style={{
                background: 'rgba(0, 112, 243, 0.1)',
                borderLeft: '2px solid var(--blue)',
                color: 'var(--text-secondary)',
              }}
            >
              <div style={{ color: 'var(--blue)', fontWeight: 600, marginBottom: '4px' }}>
                🔍 Chosen because:
              </div>
              {matchReason}
            </div>
          )}

          {/* Metrics */}
          {relevantCaseStudy.metrics && relevantCaseStudy.metrics.length > 0 && (
            <ul className="space-y-2 mb-4">
              {relevantCaseStudy.metrics.slice(0, 3).map((metric, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span style={{ color: 'var(--green)', flexShrink: 0 }}>✓</span>
                  <span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {metric.value}
                    </strong>{' '}
                    {metric.description}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Quote */}
          {relevantCaseStudy.quote && (
            <blockquote
              className="text-sm italic mb-4 pl-4 border-l-2"
              style={{
                color: 'var(--text-secondary)',
                borderColor: 'var(--border)',
              }}
            >
              "{relevantCaseStudy.quote}"
              {relevantCaseStudy.quotedPerson && (
                <footer className="mt-2 not-italic text-xs">
                  — {relevantCaseStudy.quotedPerson.name},{' '}
                  {relevantCaseStudy.quotedPerson.title}
                </footer>
              )}
            </blockquote>
          )}

          {/* Read More Link */}
          <a
            href={relevantCaseStudy.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--blue)' }}
          >
            Read the full story
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </a>
        </div>
      )}

      {/* Generic Customer Stories Link - Show when no relevant case study found */}
      {!isLoading && !relevantCaseStudy && leadData && (
        <div
          className="mt-8 mb-6 p-6 rounded-md border text-center"
          style={{
            background: 'var(--background-primary)',
            borderColor: 'var(--border)',
          }}
        >
          {devModeEnabled && matchReason && (
            <div
              className="mb-4 p-3 rounded text-xs font-mono text-left"
              style={{
                background: 'rgba(255, 152, 0, 0.1)',
                borderLeft: '2px solid var(--amber)',
                color: 'var(--text-secondary)',
              }}
            >
              <div style={{ color: 'var(--amber)', fontWeight: 600, marginBottom: '4px' }}>
                ⚠️ No targeted match:
              </div>
              {matchReason}
            </div>
          )}

          <p
            className="text-sm mb-4"
            style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}
          >
            Explore how companies across industries are building with Vercel
          </p>

          <a
            href="https://vercel.com/customers"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--blue)' }}
          >
            View all customer stories
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </a>
        </div>
      )}

      {/* Optional Reset Button */}
      {onReset && (
        <button
          onClick={onReset}
          className="px-6 py-2 rounded-md border transition-all duration-150 hover:border-opacity-100"
          style={{
            background: 'transparent',
            borderColor: 'var(--border)',
            color: 'var(--text-secondary)',
            fontSize: '14px',
          }}
        >
          Submit Another Inquiry
        </button>
      )}

      {/* Info Text */}
      <p
        className="text-xs mt-6"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span className="font-mono">
          Response time: 24-48 hours
        </span>
      </p>
    </div>
  );
}

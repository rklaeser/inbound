'use client';

import { useState, useEffect } from 'react';
import type { CaseStudy } from '@/lib/case-studies';

interface CaseStudiesProps {
  initialCaseStudies: CaseStudy[];
}

export default function CaseStudies({ initialCaseStudies }: CaseStudiesProps) {
  // Start with server-provided data (instant render)
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>(initialCaseStudies);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optionally refetch fresh data in the background
  useEffect(() => {
    // Only refetch if we want to ensure real-time updates
    // For case studies, initial data is usually sufficient
    // Uncomment below to enable background refresh:
    // fetchCaseStudies();
  }, []);

  async function fetchCaseStudies() {
    try {
      const response = await fetch('/api/case-studies');
      const data = await response.json();

      if (data.success) {
        setCaseStudies(data.data);
      } else {
        setError(data.error || 'Failed to fetch case studies');
      }
    } catch (err) {
      setError('Failed to fetch case studies');
      console.error(err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2">
          <svg
            className="animate-spin h-5 w-5"
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
          <span style={{ color: 'var(--text-secondary)' }}>Loading case studies...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="p-4 rounded-md border"
        style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderColor: '#ef4444',
        }}
      >
        <p style={{ color: '#ef4444' }}>{error}</p>
      </div>
    );
  }

  if (caseStudies.length === 0) {
    return (
      <div className="text-center py-12">
        <p style={{ color: 'var(--text-secondary)' }} className="mb-4">
          No case studies found. Run the migration script to populate Firebase.
        </p>
        <code
          className="px-3 py-1 rounded text-sm font-mono"
          style={{
            backgroundColor: 'var(--background-secondary)',
            color: 'var(--text-primary)'
          }}
        >
          npx tsx ../scripts/migrate-case-studies.ts
        </code>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {caseStudies.map((caseStudy) => (
        <div
          key={caseStudy.id}
          className="p-6 rounded-md border"
          style={{
            backgroundColor: 'var(--background-secondary)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3
                className="text-lg font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {caseStudy.company}
              </h3>
              <p
                className="text-sm mt-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                {caseStudy.industry}
              </p>
            </div>
            <a
              href={caseStudy.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-3 py-1 rounded border transition-opacity hover:opacity-70"
              style={{
                color: 'var(--blue)',
                borderColor: 'var(--border)',
              }}
            >
              View →
            </a>
          </div>

          {/* Description */}
          <p
            className="text-sm mb-4"
            style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}
          >
            {caseStudy.description}
          </p>

          {/* Metrics */}
          {caseStudy.metrics && caseStudy.metrics.length > 0 && (
            <div className="mb-4">
              <p
                className="text-xs font-medium uppercase tracking-wider mb-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                Key Metrics
              </p>
              <div className="flex flex-wrap gap-3">
                {caseStudy.metrics.map((metric, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-1 rounded text-sm"
                    style={{
                      backgroundColor: 'rgba(0, 170, 0, 0.1)',
                      color: 'var(--green)',
                    }}
                  >
                    <strong>{metric.value}</strong> {metric.description}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          <div className="mb-4">
            <p
              className="text-xs font-medium uppercase tracking-wider mb-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              Vercel Products
            </p>
            <div className="flex flex-wrap gap-2">
              {caseStudy.products.map((product, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 rounded text-xs"
                  style={{
                    backgroundColor: 'var(--background-primary)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {product}
                </span>
              ))}
            </div>
          </div>

          {/* Quote */}
          {caseStudy.quote && (
            <blockquote
              className="text-sm italic pl-4 border-l-2"
              style={{
                color: 'var(--text-secondary)',
                borderColor: 'var(--border)',
              }}
            >
              "{caseStudy.quote}"
              {caseStudy.quotedPerson && (
                <footer className="mt-2 not-italic text-xs">
                  — {caseStudy.quotedPerson.name}, {caseStudy.quotedPerson.title}
                </footer>
              )}
            </blockquote>
          )}
        </div>
      ))}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firestore';
import type { MatchedCaseStudy } from '@/lib/types';

interface SentEmail {
  subject: string;
  html: string;
}

interface SuccessMessageProps {
  leadId?: string;
  devModeEnabled?: boolean;
}

export default function SuccessMessage({ leadId, devModeEnabled }: SuccessMessageProps) {
  const [caseStudies, setCaseStudies] = useState<MatchedCaseStudy[]>([]);
  const [sentEmail, setSentEmail] = useState<SentEmail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leadId) {
      setIsLoading(false);
      return;
    }

    // Subscribe to lead document changes using Firestore onSnapshot
    const unsubscribe = onSnapshot(
      doc(db, 'leads', leadId),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          // Update case studies when available
          if (data?.matched_case_studies && data.matched_case_studies.length > 0) {
            setCaseStudies(data.matched_case_studies);
            setIsLoading(false);
          }
          // Update sent email when available
          if (data?.sent_email) {
            setSentEmail(data.sent_email);
          }
        }
      },
      (err) => {
        console.error('Error listening to lead:', err);
        setError('Unable to load case studies');
        setIsLoading(false);
      }
    );

    // Set a timeout to stop loading after 30 seconds (fallback)
    const timeout = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
      }
    }, 30000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [leadId]);

  return (
    <div className="text-center">
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
        We'll be in touch!
      </h2>

      {/* Success Message with Link */}
      <p
        className="text-base mb-6"
        style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}
      >
        In the meantime,{' '}
        <a
          href="https://vercel.com/customers"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-opacity hover:opacity-70"
          style={{ color: 'var(--blue)' }}
        >
          see how industry leading companies use Vercel.
        </a>
      </p>

      {/* Case Studies Grid */}
      {caseStudies.length > 0 && (
        <div
          className="mt-8 mb-6 grid gap-4"
          style={{
            gridTemplateColumns: caseStudies.length > 1 ? 'repeat(2, 1fr)' : '1fr',
          }}
        >
          {caseStudies.map((caseStudy, index) => (
            <CaseStudyCard
              key={caseStudy.caseStudyId || index}
              caseStudy={caseStudy}
              devModeEnabled={devModeEnabled}
            />
          ))}
        </div>
      )}

      {/* Book a Meeting Card */}
      {sentEmail && leadId && (
        <div
          className="mt-8 mb-6 p-6 rounded-md border relative"
          style={{
            background: 'var(--background-primary)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Just now label - top left corner */}
          <p
            className="text-xs font-medium absolute top-1 left-3"
            style={{ color: 'var(--green)' }}
          >
            Just now
          </p>

          <div className="flex items-center justify-between gap-4">
            {/* Book Meeting Button - Left */}
            <a
              href={`/sent-emails/${leadId}`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md font-medium transition-opacity hover:opacity-90"
              style={{
                background: 'var(--foreground)',
                color: 'var(--background)',
              }}
            >
              <svg
                className="w-5 h-5"
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
              Book a Meeting
            </a>

            {/* SDR Profile - Right */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p
                  className="text-base font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Ryan Vercel
                </p>
                <p
                  className="text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Development Manager
                </p>
              </div>
              <img
                src="/profpic.jpeg"
                alt="Ryan"
                className="w-12 h-12 rounded-full object-cover"
              />
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div
          className="mt-8 mb-6 p-4 rounded-md border text-center"
          style={{
            background: 'var(--background-primary)',
            borderColor: 'var(--border)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {error}
          </p>
        </div>
      )}

    </div>
  );
}

/**
 * Individual Case Study Card Component - Vercel customers page style
 */
function CaseStudyCard({
  caseStudy,
  devModeEnabled,
}: {
  caseStudy: MatchedCaseStudy;
  devModeEnabled?: boolean;
}) {
  return (
    <div
      className="p-5 rounded-md border text-left flex flex-col"
      style={{
        background: 'var(--background-primary)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Logo at top */}
      <div className="mb-4 h-8 flex items-center">
        {caseStudy.logoSvg ? (
          <img
            src={`data:image/svg+xml;base64,${btoa(caseStudy.logoSvg)}`}
            alt={`${caseStudy.company} logo`}
            className="h-8 max-w-[140px] object-contain"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
        ) : (
          <span className="text-[#888] text-lg font-semibold">{caseStudy.company}</span>
        )}
      </div>

      {/* Dev Mode: Match Reason */}
      {devModeEnabled && caseStudy.matchReason && (
        <div
          className="mb-3 p-2 rounded text-xs font-mono"
          style={{
            background: 'rgba(0, 112, 243, 0.1)',
            borderLeft: '2px solid var(--blue)',
            color: 'var(--text-secondary)',
          }}
        >
          {caseStudy.matchReason}
        </div>
      )}

      {/* Featured Text */}
      {caseStudy.featuredText && (
        <p
          className="text-base mb-4"
          style={{ color: '#888', lineHeight: '1.6' }}
        >
          {caseStudy.featuredText}
        </p>
      )}

      {/* Spacer to push Read story to bottom */}
      <div className="flex-grow" />

      {/* Read the full story link */}
      <a
        href={caseStudy.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm transition-colors hover:text-[#a1a1a1] mt-auto"
        style={{ color: '#888' }}
      >
        Read the full story
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="ml-1">
          <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </a>
    </div>
  );
}

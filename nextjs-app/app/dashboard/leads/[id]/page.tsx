'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/db/client';
import type { Lead, Classification, Configuration } from '@/lib/types';
import { getCurrentClassification, DEFAULT_CONFIGURATION, getClassificationDisplay, CLASSIFICATIONS, getClassificationLabel } from '@/lib/types';
import { extractFirstName, getBaseUrl } from '@/lib/email/helpers';
import { calculateTTR } from '@/lib/date-utils';
import { getSDRAvatarUrl } from '@/lib/sdr-profiles';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { CaseStudyEditor } from '@/components/dashboard/CaseStudyEditor';
import { ChevronRight, Check } from 'lucide-react';
import { Attribution } from '@/components/shared/Attribution';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configuration, setConfiguration] = useState<Configuration | null>(null);

  // Classification state
  const [classifying, setClassifying] = useState(false);

  // Email state
  const [isEmailExpanded, setIsEmailExpanded] = useState(false);

  // Research report state
  const [isResearchExpanded, setIsResearchExpanded] = useState(false);

  // Reply button state
  const [isSending, setIsSending] = useState(false);

  // Timeline highlight state (for #timeline hash navigation)
  const [highlightTimeline, setHighlightTimeline] = useState(false);

  // Eval dropdown state
  const [isClassificationEvalExpanded, setIsClassificationEvalExpanded] = useState(false);
  const [isEmailEvalExpanded, setIsEmailEvalExpanded] = useState(false);

  // Subscribe to configuration for email templates
  useEffect(() => {
    const configRef = doc(db, 'settings', 'configuration');

    const unsubscribe = onSnapshot(
      configRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          setConfiguration(docSnapshot.data() as Configuration);
        }
      },
      (err) => {
        console.error('Error fetching configuration:', err);
      }
    );

    return () => unsubscribe();
  }, []);

  // Get the full email content (already assembled with greeting, body, CTA, etc.)
  const getEmailContent = (): string | null => {
    if (!lead) return null;
    // email.text contains the fully assembled email
    return lead.email?.text || null;
  };

  // Get email subject for any classification type
  const getEmailSubject = (): string | null => {
    if (!lead || !configuration) return null;
    const classification = getCurrentClassification(lead);
    if (!classification) return null;

    const firstName = extractFirstName(lead.submission.leadName);
    const defaultTemplates = DEFAULT_CONFIGURATION.emailTemplates;

    switch (classification) {
      case 'high-quality': {
        const template = configuration.emailTemplates?.highQuality || defaultTemplates.highQuality;
        return template.subject.replace('{firstName}', firstName);
      }
      case 'low-quality': {
        const template = configuration.emailTemplates?.lowQuality || defaultTemplates.lowQuality;
        return template.subject;
      }
      case 'support': {
        const template = configuration.emailTemplates?.support || defaultTemplates.support;
        return template.subject.replace('{firstName}', firstName);
      }
      case 'existing': {
        const template = configuration.emailTemplates?.existing || defaultTemplates.existing;
        return template.subject.replace('{firstName}', firstName);
      }
      default:
        return null;
    }
  };

  // Get email content for any classification type - returns HTML for display
  const getEmailForClassification = (): string | null => {
    if (!lead || !configuration) return null;
    const classification = getCurrentClassification(lead);
    if (!classification) return null;

    const firstName = extractFirstName(lead.submission.leadName);
    const defaultTemplates = DEFAULT_CONFIGURATION.emailTemplates;

    switch (classification) {
      case 'high-quality':
        // email.text contains the fully assembled email
        return getEmailContent();
      case 'low-quality': {
        // Use configuration template (HTML) - replace placeholder
        const lowQualityTemplate = configuration.emailTemplates?.lowQuality || defaultTemplates.lowQuality;
        return lowQualityTemplate.body.replace(/{firstName}/g, firstName);
      }
      case 'support': {
        // Templates are HTML - replace all placeholders
        const supportTemplate = configuration.emailTemplates?.support || defaultTemplates.support;
        const supportGreeting = supportTemplate.greeting.replace('{firstName}', firstName);
        const supportBody = supportTemplate.body
          .replace(/{baseUrl}/g, getBaseUrl())
          .replace(/{leadId}/g, lead.id)
          .replace(/{company}/g, lead.submission.company);
        return `${supportGreeting}${supportBody}`;
      }
      case 'existing': {
        // Templates are HTML - replace all placeholders
        const existingTemplate = configuration.emailTemplates?.existing || defaultTemplates.existing;
        const existingGreeting = existingTemplate.greeting.replace('{firstName}', firstName);
        const existingBody = existingTemplate.body
          .replace(/{baseUrl}/g, getBaseUrl())
          .replace(/{leadId}/g, lead.id)
          .replace(/{company}/g, lead.submission.company);
        return `${existingGreeting}${existingBody}`;
      }
      default:
        return null;
    }
  };

  // Get internal email content for support/existing - returns HTML for display
  const getInternalEmailForClassification = (): string | null => {
    if (!lead || !configuration) return null;
    const classification = getCurrentClassification(lead);
    if (classification !== 'support' && classification !== 'existing') return null;

    const firstName = extractFirstName(lead.submission.leadName);
    const defaultTemplates = DEFAULT_CONFIGURATION.emailTemplates;
    const baseUrl = getBaseUrl();

    if (classification === 'support') {
      const template = configuration.emailTemplates?.supportInternal || defaultTemplates.supportInternal;
      return template.body
        .replace(/{firstName}/g, firstName)
        .replace(/{email}/g, lead.submission.email)
        .replace(/{company}/g, lead.submission.company)
        .replace(/{message}/g, lead.submission.message)
        .replace(/{baseUrl}/g, baseUrl)
        .replace(/{leadId}/g, lead.id);
    }

    if (classification === 'existing') {
      const template = configuration.emailTemplates?.existingInternal || defaultTemplates.existingInternal;
      return template.body
        .replace(/{firstName}/g, firstName)
        .replace(/{email}/g, lead.submission.email)
        .replace(/{company}/g, lead.submission.company)
        .replace(/{message}/g, lead.submission.message)
        .replace(/{baseUrl}/g, baseUrl)
        .replace(/{leadId}/g, lead.id);
    }

    return null;
  };

  // Get internal email recipient label
  const getInternalEmailRecipient = (): string | null => {
    if (!lead) return null;
    const classification = getCurrentClassification(lead);
    if (classification === 'support') return 'Support Team';
    if (classification === 'existing') return 'Account Team';
    return null;
  };

  // Check if customer email should be shown based on classification and config
  const shouldShowCustomerEmail = (): boolean => {
    if (!lead || !configuration) return false;
    const classification = getCurrentClassification(lead);
    if (classification === 'high-quality') return true;
    if (classification === 'low-quality') return configuration.responseToLead?.lowQuality ?? false;
    if (classification === 'support') return configuration.responseToLead?.support ?? false;
    if (classification === 'existing') return configuration.responseToLead?.existing ?? false;
    return false;
  };

  // Get button text based on classification
  const getReplyButtonText = (): string => {
    if (!lead || !configuration) return 'Reply';
    const classification = getCurrentClassification(lead);

    // When customer email is disabled, just forward internally
    if (classification === 'support' && !configuration.responseToLead?.support) {
      return 'Forward to Support';
    }
    if (classification === 'existing' && !configuration.responseToLead?.existing) {
      return 'Forward to Account Team';
    }

    // Original logic
    if (classification === 'support' || classification === 'existing') {
      return 'Reply & Forward';
    }
    return 'Reply';
  };

  useEffect(() => {
    const leadRef = doc(db, 'leads', id);

    const unsubscribe = onSnapshot(
      leadRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          setLead({ id: docSnapshot.id, ...docSnapshot.data() } as Lead);
          setError(null);
        } else {
          setError('Lead not found');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching lead:', err);
        setError('Failed to load lead');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  // Handle #timeline hash navigation - scroll to and highlight timeline section
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#timeline' && lead) {
      // Small delay to ensure the section is rendered
      setTimeout(() => {
        const timelineSection = document.getElementById('timeline');
        if (timelineSection) {
          timelineSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightTimeline(true);
          // Remove highlight after animation completes
          setTimeout(() => setHighlightTimeline(false), 2000);
        }
      }, 100);
    }
  }, [lead]); // Re-run when lead data loads

  // Auto-save handler for the email editor
  const handleEmailSave = async (html: string) => {
    await fetch(`/api/leads/${id}/review/edit`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_text: html }),
    });
  };

  const handleApprove = async () => {
    setIsSending(true);
    try {
      await fetch(`/api/leads/${id}/review/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      // Stay on page - the real-time listener will update the UI to show "Sent" status
    } catch (error) {
      console.error('Error approving lead:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleReclassifyTo = async (newClassification: Classification) => {
    try {
      await fetch(`/api/leads/${id}/review/reclassify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_classification: newClassification }),
      });
    } catch (error) {
      console.error('Error reclassifying lead:', error);
    }
  };

  const handleClassify = async (classification: Classification) => {
    setClassifying(true);
    try {
      const response = await fetch(`/api/leads/${id}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classification }),
      });

      const result = await response.json();

      if (result.success) {
        // Stay on page - the real-time Firestore listener will update the UI
      }
    } catch (error) {
      console.error('Error classifying lead:', error);
    } finally {
      setClassifying(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="space-y-6">
          <div className="h-8 bg-muted rounded-md w-1/3 animate-pulse"></div>
          <div className="h-64 bg-muted rounded-md animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="p-8">
        <div
          className="bg-[#0a0a0a] border border-[rgba(239,68,68,0.2)] rounded-md p-4"
          style={{ color: '#ef4444' }}
        >
          {error || 'Lead not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans">
      {/* Lead Header */}
      <div className="mb-8">
        {/* First row: Company name, badge, and stage indicator */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <h1
              className="font-semibold text-foreground"
              style={{
                fontSize: '24px',
                lineHeight: '1.2',
                fontWeight: 600
              }}
            >
              {lead.submission.company}
            </h1>
            <a
              href={`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(lead.submission.company)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-70"
              style={{ transition: 'opacity 0.15s ease' }}
              title="Search Company on LinkedIn"
            >
              <img src="/linkedIn.svg" alt="LinkedIn" className="h-5 w-5" />
            </a>
            <ClassificationBadge lead={lead} onReclassify={handleReclassifyTo} />
          </div>
          <StageIndicator status={lead.status.status} />
        </div>

        {/* Contact info */}
        <div
          className="flex items-center gap-2 text-muted-foreground"
          style={{
            fontSize: '13px',
            lineHeight: '1.6'
          }}
        >
          <span>{lead.submission.leadName}</span>
          <a
            href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(lead.submission.leadName + ' ' + lead.submission.company)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-70"
            style={{ transition: 'opacity 0.15s ease' }}
            title="Search on LinkedIn"
          >
            <img src="/linkedIn.svg" alt="LinkedIn" className="h-4 w-4" />
          </a>
        </div>

        {/* Message */}
        <div
          className="mt-3 text-foreground"
          style={{
            fontSize: '13px',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap'
          }}
        >
          {lead.submission.message}
        </div>

        {/* Reroute Information */}
        {lead.reroute && (
          <div
            className="mt-4 p-4 rounded-md border"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.05)',
              borderColor: 'rgba(245, 158, 11, 0.2)',
            }}
          >
            <div
              className="flex items-center gap-2 mb-2"
              style={{ fontSize: '12px', fontWeight: 600, color: '#f59e0b' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Rerouted by {lead.reroute.source === 'customer' ? 'Customer' : lead.reroute.source === 'support' ? 'Support Team' : 'Sales Team'}
            </div>
            <div className="space-y-2" style={{ fontSize: '13px', lineHeight: '1.6' }}>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Original classification:</span>
                <span className="text-foreground">{getClassificationLabel(lead.reroute.originalClassification)}</span>
              </div>
              {lead.reroute.previousTerminalState && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Previous action:</span>
                  <span className="text-foreground">{lead.reroute.previousTerminalState.replace(/_/g, ' ')}</span>
                </div>
              )}
              {lead.reroute.reason && (
                <div>
                  <span className="text-muted-foreground">Reason: </span>
                  <span className="text-foreground" style={{ whiteSpace: 'pre-wrap' }}>{lead.reroute.reason}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Classification UI - Show for leads needing human classification */}
      {(lead.status.status === 'classify' || (lead.status.status === 'review' && lead.classifications.length === 0)) && (
        <div className="mb-6">
          <Section title="Classify">
            {/* Note: Bot prediction is intentionally hidden during human classification to avoid bias */}
            {/* The Research Report section below can still be expanded if needed */}

            {/* Classification Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => handleClassify('high-quality')}
                disabled={classifying}
                variant="outline"
                className="h-auto py-4 flex flex-col items-start text-left hover:bg-[rgba(34,197,94,0.1)]"
                style={{
                  color: '#22c55e',
                  borderColor: 'rgba(34,197,94,0.2)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>High Quality</div>
                <div style={{ fontSize: '11px', color: '#a1a1a1', fontWeight: 400, whiteSpace: 'normal' }}>
                  Follow up
                </div>
              </Button>

              <Button
                onClick={() => handleClassify('low-quality')}
                disabled={classifying}
                variant="outline"
                className="h-auto py-4 flex flex-col items-start text-left hover:bg-[rgba(161,161,161,0.1)]"
                style={{
                  color: '#737373',
                  borderColor: 'rgba(161,161,161,0.2)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Low Quality</div>
                <div style={{ fontSize: '11px', color: '#a1a1a1', fontWeight: 400, whiteSpace: 'normal' }}>
                  Dead lead
                </div>
              </Button>

              <Button
                onClick={() => handleClassify('support')}
                disabled={classifying}
                variant="outline"
                className="h-auto py-4 flex flex-col items-start text-left hover:bg-[rgba(59,130,246,0.1)]"
                style={{
                  color: '#3b82f6',
                  borderColor: 'rgba(59,130,246,0.2)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Support</div>
                <div style={{ fontSize: '11px', color: '#a1a1a1', fontWeight: 400, whiteSpace: 'normal' }}>
                  Technical request without a sales component
                </div>
              </Button>

            </div>

            {classifying && (
              <div className="mt-4 text-center" style={{ fontSize: '13px', color: '#a1a1a1' }}>
                Classifying...
              </div>
            )}
          </Section>
        </div>
      )}

      {/* Content Grid */}
      <div className="space-y-4">
        {/* Research & Classification */}
        {lead.bot_research && (
          <Section
            title="Research Report"
            titleExtra={
              /* Hide classification badge and confidence when in classify mode to avoid biasing human */
              lead.status.status !== 'classify' ? (
                <div className="flex items-center gap-3">
                  {getCurrentClassification(lead) && (
                    <ClassificationBadge lead={lead} onReclassify={handleReclassifyTo} />
                  )}
                  {lead.bot_research.confidence && (
                    <span
                      className="font-mono"
                      style={{
                        fontSize: '12px',
                        color: '#a1a1a1'
                      }}
                    >
                      {(lead.bot_research.confidence * 100).toFixed(0)}% confidence
                    </span>
                  )}
                </div>
              ) : undefined
            }
            rightContent={
              <div className="flex items-center gap-3">
                {lead.bot_research.timestamp && (
                  <Attribution date={lead.bot_research.timestamp} by={null} />
                )}
                <span title="Generated by Bot">🤖</span>
              </div>
            }
          >
            {/* Bot Reasoning - hidden in classify mode to avoid biasing human */}
            {lead.status.status !== 'classify' && getCurrentClassification(lead) && lead.bot_research.reasoning && (
              <div className="mb-4 pb-4 border-b border-border">
                <p
                  className="text-muted-foreground"
                  style={{
                    fontSize: '13px',
                    lineHeight: '1.6',
                    fontStyle: 'italic'
                  }}
                >
                  {lead.bot_research.reasoning}
                </p>
              </div>
            )}

            {/* Full Research Report - Expandable */}
            {lead.bot_research.researchReport && (
              <div>
                <button
                  onClick={() => setIsResearchExpanded(!isResearchExpanded)}
                  className="flex items-center gap-2 text-sm hover:text-[#fafafa] transition-colors"
                  style={{ color: '#a1a1a1' }}
                >
                  <ChevronRight
                    className={`h-4 w-4 transition-transform ${isResearchExpanded ? 'rotate-90' : ''}`}
                  />
                  <span>{isResearchExpanded ? 'Hide full research report' : 'View full research report'}</span>
                </button>

                {isResearchExpanded && (
                  <div
                    className="mt-3 bg-background border border-border rounded-md p-4 prose prose-sm max-w-none dark:prose-invert"
                  >
                    <ReactMarkdown
                      components={{
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                            {children}
                          </a>
                        ),
                        p: ({ children }) => (
                          <p style={{ whiteSpace: 'pre-line', marginBottom: '0.75rem' }}>{children}</p>
                        ),
                      }}
                    >
                      {lead.bot_research.researchReport}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            )}

            {/* Classification Eval - Inline, hidden in classify mode to avoid biasing human */}
            {lead.status.status !== 'classify' && lead.eval_results?.classification && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setIsClassificationEvalExpanded(!isClassificationEvalExpanded)}
                    className="flex items-center gap-2 text-sm hover:text-[#fafafa] transition-colors"
                    style={{ color: '#a1a1a1' }}
                  >
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${isClassificationEvalExpanded ? 'rotate-90' : ''}`}
                    />
                    <span>Classification Eval</span>
                  </button>
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium font-mono"
                    style={{
                      backgroundColor: lead.eval_results.classification.pass
                        ? 'rgba(34, 197, 94, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                      color: lead.eval_results.classification.pass ? '#22c55e' : '#ef4444',
                    }}
                  >
                    {lead.eval_results.classification.score}/5
                  </span>
                </div>
                {isClassificationEvalExpanded && (
                  <div className="mt-3 p-3 bg-background border border-border rounded-md">
                    <p className="text-sm text-muted-foreground" style={{ lineHeight: '1.6' }}>
                      {lead.eval_results.classification.reasoning}
                    </p>
                    <p className="text-xs text-muted-foreground/50 mt-2">
                      Model: {lead.eval_results.classification.model}
                    </p>
                  </div>
                )}
              </div>
            )}

          </Section>
        )}

        {/* Low Quality Confirm - Show when low-quality and customer email is disabled */}
        {getCurrentClassification(lead) === 'low-quality' && configuration && !shouldShowCustomerEmail() && lead.status.status !== 'done' && (
          <Section
            title="Confirm Classification"
            rightContent={
              <Button
                onClick={handleApprove}
                disabled={isSending}
                size="sm"
                variant="info"
              >
                {isSending ? 'Confirming...' : 'Confirm Low Quality'}
              </Button>
            }
          >
            <p className="text-sm text-muted-foreground">
              No customer email will be sent. Click to confirm and mark as done.
            </p>
          </Section>
        )}

        {/* Email - Show for classified leads when customer email is enabled */}
        {getCurrentClassification(lead) && configuration && shouldShowCustomerEmail() && (
          <Section
            title="Email"
            rightContent={lead.status.status === 'done' ? (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md"
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  color: '#22c55e',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                }}
              >
                <Check className="h-3.5 w-3.5" />
                <span style={{ fontSize: '12px', fontWeight: 500 }}>Sent</span>
              </div>
            ) : (
              <Button
                onClick={handleApprove}
                disabled={isSending}
                size="sm"
                variant="info"
              >
                {isSending ? 'Sending...' : getReplyButtonText()}
              </Button>
            )}
          >
            {/* Email metadata - From, To, Subject */}
            <div
              className="mb-4 pb-3 border-b border-border space-y-1"
              style={{ fontSize: '12px', color: '#666' }}
            >
              <div className="flex items-center gap-2">
                <span className="w-12">From:</span>
                <span style={{ color: '#a1a1a1' }}>{configuration.sdr?.email || 'ryan@vercel.com'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-12">To:</span>
                <span style={{ color: '#a1a1a1' }}>{lead.submission.email}</span>
              </div>
              {getEmailSubject() && (
                <div className="flex items-center gap-2">
                  <span className="w-12">Subject:</span>
                  <span style={{ color: '#a1a1a1' }}>{getEmailSubject()}</span>
                </div>
              )}
            </div>

            {/* Done state: Show sent email as read-only */}
            {lead.status.status === 'done' && (
              <div
                className="max-w-none [&_p]:mb-3 [&_p:last-child]:mb-0 [&_a]:text-blue-400 [&_a]:underline text-muted-foreground"
                style={{
                  fontSize: '13px',
                  lineHeight: '1.6',
                }}
                dangerouslySetInnerHTML={{ __html: getEmailForClassification() ?? '' }}
              />
            )}

            {/* Not done: Show editable email */}
            {lead.status.status !== 'done' && (
              <>
                {/* High-quality: Always show editor */}
                {getCurrentClassification(lead) === 'high-quality' && (
                  <RichTextEditor
                    initialContent={getEmailForClassification() ?? ''}
                    onSave={handleEmailSave}
                  />
                )}

                {/* Non-high-quality: Collapsible with chevron */}
                {getCurrentClassification(lead) !== 'high-quality' && (
                  <div className="space-y-4">
                    {/* Expand toggle */}
                    <button
                      onClick={() => setIsEmailExpanded(!isEmailExpanded)}
                      className="flex items-center gap-2 text-sm text-[#a1a1a1] hover:text-[#fafafa] transition-colors"
                    >
                      <ChevronRight
                        className={`h-4 w-4 transition-transform ${isEmailExpanded ? 'rotate-90' : ''}`}
                      />
                      <span>{isEmailExpanded ? 'Hide email preview' : 'Show email preview'}</span>
                    </button>

                    {/* Expandable editor */}
                    {isEmailExpanded && (
                      <RichTextEditor
                        initialContent={getEmailForClassification() ?? ''}
                        onSave={handleEmailSave}
                      />
                    )}
                  </div>
                )}
              </>
            )}

            {/* Email Eval - Inline (high-quality only) */}
            {getCurrentClassification(lead) === 'high-quality' && lead.eval_results?.email && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setIsEmailEvalExpanded(!isEmailEvalExpanded)}
                    className="flex items-center gap-2 text-sm hover:text-[#fafafa] transition-colors"
                    style={{ color: '#a1a1a1' }}
                  >
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${isEmailEvalExpanded ? 'rotate-90' : ''}`}
                    />
                    <span>Email Eval</span>
                  </button>
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium font-mono"
                    style={{
                      backgroundColor: lead.eval_results.email.pass
                        ? 'rgba(34, 197, 94, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                      color: lead.eval_results.email.pass ? '#22c55e' : '#ef4444',
                    }}
                  >
                    {lead.eval_results.email.overall}/5
                  </span>
                </div>
                {isEmailEvalExpanded && (
                  <div className="mt-3 p-3 bg-background border border-border rounded-md">
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <ScoreChip label="Relevant" score={lead.eval_results.email.scores.relevant} />
                      <ScoreChip label="Direct" score={lead.eval_results.email.scores.direct} />
                      <ScoreChip label="Active" score={lead.eval_results.email.scores.active} />
                    </div>
                    <p className="text-sm text-muted-foreground" style={{ lineHeight: '1.6' }}>
                      {lead.eval_results.email.summary}
                    </p>
                    <p className="text-xs text-muted-foreground/50 mt-2">
                      Model: {lead.eval_results.email.model}
                    </p>
                  </div>
                )}
              </div>
            )}
          </Section>
        )}

        {/* Case Studies - Show for high-quality leads when experimental feature is enabled */}
        {configuration?.experimental?.caseStudies && getCurrentClassification(lead) === 'high-quality' && (
          <Section title="Included Case Studies">
            {(lead.matched_case_studies && lead.matched_case_studies.length > 0) || lead.status.status !== 'done' ? (
              <CaseStudyEditor
                leadId={lead.id}
                caseStudies={lead.matched_case_studies || []}
                onUpdate={(updatedCaseStudies) => {
                  // The Firestore listener will update the lead automatically
                  // But we can also update local state for immediate feedback
                  setLead(prev => prev ? { ...prev, matched_case_studies: updatedCaseStudies } : null);
                }}
                disabled={lead.status.status === 'done'}
              />
            ) : (
              <p className="text-sm text-[#666]">No case studies included.</p>
            )}
          </Section>
        )}

        {/* Internal Email - Show for support/existing classifications */}
        {(getCurrentClassification(lead) === 'support' || getCurrentClassification(lead) === 'existing') && configuration && (
          <Section
            title={`Internal Email to ${getInternalEmailRecipient()}`}
            rightContent={lead.status.status === 'done' ? (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md"
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  color: '#22c55e',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                }}
              >
                <Check className="h-3.5 w-3.5" />
                <span style={{ fontSize: '12px', fontWeight: 500 }}>Sent</span>
              </div>
            ) : !shouldShowCustomerEmail() ? (
              // When customer email is disabled, show the forward action button here
              <Button
                onClick={handleApprove}
                disabled={isSending}
                size="sm"
                variant="info"
              >
                {isSending ? 'Forwarding...' : getReplyButtonText()}
              </Button>
            ) : (
              <div
                className="px-2.5 py-1 rounded-md"
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                Pending
              </div>
            )}
          >
            <div
              className="max-w-none [&_p]:mb-3 [&_p:last-child]:mb-0 [&_a]:text-blue-400 [&_a]:underline text-muted-foreground"
              style={{
                fontSize: '13px',
                lineHeight: '1.6',
              }}
              dangerouslySetInnerHTML={{ __html: getInternalEmailForClassification() ?? '' }}
            />
          </Section>
        )}

        {/* Bot vs Human Classification Comparison - Show for done leads where human classified */}
        {lead.status.status === 'done' && lead.bot_research && lead.classifications.length > 0 && lead.classifications[0].author === 'human' && (
          <Section title="Bot vs Human Comparison">
            <div className="space-y-4">
              {/* Comparison Result */}
              <div className="flex items-center gap-4">
                {lead.bot_research.classification === lead.classifications[0].classification ? (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-md"
                    style={{
                      backgroundColor: 'rgba(34, 197, 94, 0.1)',
                      border: '1px solid rgba(34, 197, 94, 0.2)',
                    }}
                  >
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span className="text-emerald-400 text-sm font-medium">Agreement</span>
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-md"
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                    }}
                  >
                    <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-red-400 text-sm font-medium">Disagreement</span>
                  </div>
                )}
              </div>

              {/* Side by side comparison */}
              <div className="grid grid-cols-2 gap-4">
                {/* Bot Classification */}
                <div
                  className="p-4 rounded-md"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="h-4 w-4 text-[#666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#a1a1a1' }}>
                      Bot Would Have Classified
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="px-2.5 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `rgba(${getClassificationColor(lead.bot_research.classification)}, 0.1)`,
                        color: `rgb(${getClassificationColor(lead.bot_research.classification)})`,
                        border: `1px solid rgba(${getClassificationColor(lead.bot_research.classification)}, 0.2)`,
                      }}
                    >
                      {getClassificationLabel(lead.bot_research.classification)}
                    </span>
                    <span className="text-xs font-mono text-[#666]">
                      {(lead.bot_research.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  {lead.bot_research.reasoning && (
                    <p
                      className="mt-3"
                      style={{
                        fontSize: '12px',
                        color: '#666',
                        lineHeight: '1.5',
                        fontStyle: 'italic',
                      }}
                    >
                      {lead.bot_research.reasoning}
                    </p>
                  )}
                </div>

                {/* Human Classification */}
                <div
                  className="p-4 rounded-md"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="h-4 w-4 text-[#666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#a1a1a1' }}>
                      Human Classified As
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="px-2.5 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `rgba(${getClassificationColor(lead.classifications[0].classification)}, 0.1)`,
                        color: `rgb(${getClassificationColor(lead.classifications[0].classification)})`,
                        border: `1px solid rgba(${getClassificationColor(lead.classifications[0].classification)}, 0.2)`,
                      }}
                    >
                      {getClassificationLabel(lead.classifications[0].classification)}
                    </span>
                    <span className="text-xs text-[#666]">
                      Final classification
                    </span>
                  </div>
                </div>
              </div>

              {/* Note about comparison type */}
              <p style={{ fontSize: '11px', color: '#444' }}>
                {lead.classifications.length === 1
                  ? 'This was a blind comparison - the human classified without seeing the Bot\'s prediction first.'
                  : 'This was an override - the human reviewed and changed the Bot\'s classification.'}
              </p>
            </div>
          </Section>
        )}

        {/* Timeline */}
        <Section
          title="Timeline"
          id="timeline"
          highlight={highlightTimeline}
          rightContent={
            lead.status.sent_at && (
              <span className="font-mono text-muted-foreground" style={{ fontSize: '12px' }}>
                Time to Response: <span className="text-foreground">{calculateTTR(lead.status.received_at, lead.status.sent_at)}</span>
              </span>
            )
          }
        >
          <div className="flex flex-col gap-3">
            {/* Received - always shown */}
            <TimelineItem
              label="Received"
              timestamp={lead.status.received_at}
            />

            {/* Classifications - shown if any exist */}
            {lead.classifications.length > 0 && [...lead.classifications].reverse().map((c, i) => {
              // Build reasoning for this classification
              let reason: string | undefined;

              if (c.author === 'bot' && lead.bot_research) {
                // Bot classification - show reasoning
                if (c.classification === 'existing') {
                  reason = lead.bot_research.reasoning;
                } else {
                  const confidencePct = Math.round(lead.bot_research.confidence * 100);
                  reason = `${confidencePct}% confidence. ${lead.bot_research.reasoning}`;
                }
              } else if (c.author === 'human' && lead.bot_research) {
                // Human classification - show if they agreed or disagreed with Bot
                const aiClassification = lead.bot_research.classification;
                if (c.classification === aiClassification) {
                  reason = `Agreed with Bot classification`;
                } else {
                  reason = `Changed from Bot's "${getClassificationLabel(aiClassification)}" classification`;
                }
              }

              // Determine actor based on classification author
              let actor: string;
              let avatar: string | 'bot' | 'system';

              if (c.author === 'bot') {
                actor = 'Bot';
                avatar = 'bot';
              } else {
                actor = configuration?.sdr?.name || DEFAULT_CONFIGURATION.sdr.name;
                avatar = configuration?.sdr?.avatar || DEFAULT_CONFIGURATION.sdr.avatar || 'system';
              }

              return (
                <TimelineItem
                  key={i}
                  label={`Classified as ${getClassificationLabel(c.classification)}`}
                  timestamp={c.timestamp}
                  actor={actor}
                  avatar={avatar}
                  reason={reason}
                />
              );
            })}

            {/* Edited - shown if email was edited (editedAt > createdAt or lastEditedBy is set) */}
            {lead.email && (lead.email.lastEditedBy || (() => {
              const createdAt = (lead.email.createdAt as any)?.toDate?.() ?? lead.email.createdAt;
              const editedAt = (lead.email.editedAt as any)?.toDate?.() ?? lead.email.editedAt;
              return (editedAt as Date).getTime() > (createdAt as Date).getTime();
            })()) && (
              <TimelineItem
                label="Edited"
                timestamp={lead.email.editedAt}
                reason={lead.edit_note || undefined}
              />
            )}

            {/* Sent - shown if sent */}
            {lead.status.sent_at && (() => {
              // Build reasoning for why it was sent
              let sentReason: string | undefined;
              const sentBy = lead.status.sent_by;

              if (sentBy === 'system') {
                // Deterministic rule (duplicate)
                sentReason = 'Auto-forwarded by system rule (existing customer detected)';
              } else if (sentBy === 'bot' && lead.bot_research) {
                // Bot auto-send - find the bot classification to get the applied threshold
                const botClassification = lead.classifications.find(c => c.author === 'bot');
                const confidencePct = Math.round(lead.bot_research.confidence * 100);
                if (botClassification?.applied_threshold) {
                  const thresholdPct = Math.round(botClassification.applied_threshold * 100);
                  sentReason = `Auto-sent: ${confidencePct}% confidence exceeded ${thresholdPct}% threshold`;
                } else {
                  sentReason = `Auto-sent: ${confidencePct}% confidence`;
                }
              }
              // Human-sent doesn't need a reason - it was their explicit action

              return (
                <TimelineItem
                  label="Sent"
                  timestamp={lead.status.sent_at}
                  actor={sentBy === 'bot' ? 'Bot' : sentBy === 'system' ? 'System' : sentBy || undefined}
                  avatar={sentBy === 'system' ? 'system' : sentBy === 'bot' ? 'bot' : sentBy ? getSDRAvatarUrl(sentBy) : undefined}
                  reason={sentReason}
                />
              );
            })()}
          </div>
        </Section>

      </div>
    </div>
  );
}

function ScoreChip({ label, score }: { label: string; score: number }) {
  return (
    <div className="text-center p-2 bg-muted/50 rounded">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="font-mono text-sm">{score}/5</div>
    </div>
  );
}

function StageIndicator({ status }: { status: string }) {
  const isClassifyComplete = status === 'classify' || status === 'review' || status === 'done';
  const isReviewComplete = status === 'review' || status === 'done';
  const isDoneComplete = status === 'done';

  return (
    <div className="flex items-start gap-0">
      {/* Classify stage */}
      <div className="flex flex-col items-center">
        <div
          className="h-3 w-3 rounded-full"
          style={{
            backgroundColor: isClassifyComplete ? '#eab308' : 'transparent',
            border: isClassifyComplete ? 'none' : '2px solid #404040'
          }}
        />
        <span className="text-xs mt-1" style={{ color: '#a1a1a1' }}>Classify</span>
      </div>

      {/* Connecting line */}
      <div
        className="w-8 h-0.5 mt-1.5"
        style={{
          backgroundColor: isReviewComplete ? '#f97316' : '#404040'
        }}
      />

      {/* Review stage */}
      <div className="flex flex-col items-center">
        <div
          className="h-3 w-3 rounded-full"
          style={{
            backgroundColor: isReviewComplete ? '#f97316' : 'transparent',
            border: isReviewComplete ? 'none' : '2px solid #404040'
          }}
        />
        <span className="text-xs mt-1" style={{ color: '#a1a1a1' }}>Review</span>
      </div>

      {/* Connecting line */}
      <div
        className="w-8 h-0.5 mt-1.5"
        style={{
          backgroundColor: isDoneComplete ? '#22c55e' : '#404040'
        }}
      />

      {/* Done stage */}
      <div className="flex flex-col items-center">
        <div
          className="h-3 w-3 rounded-full"
          style={{
            backgroundColor: isDoneComplete ? '#22c55e' : 'transparent',
            border: isDoneComplete ? 'none' : '2px solid #404040'
          }}
        />
        <span className="text-xs mt-1" style={{ color: '#a1a1a1' }}>Done</span>
      </div>
    </div>
  );
}

function Section({
  title,
  titleExtra,
  rightContent,
  children,
  id,
  highlight,
}: {
  title: string;
  titleExtra?: React.ReactNode;
  rightContent?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
  highlight?: boolean;
}) {
  return (
    <div
      id={id}
      className={`bg-card border border-border rounded-md p-4 ${highlight ? 'animate-pulse-border' : ''}`}
      style={{
        borderColor: highlight ? 'rgba(59, 130, 246, 0.5)' : undefined,
        transition: 'border-color 0.3s ease'
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2
            className="font-sans text-foreground"
            style={{
              fontSize: '14px',
              fontWeight: 600,
              lineHeight: '28px',
            }}
          >
            {title}
          </h2>
          {titleExtra}
        </div>
        {rightContent}
      </div>
      {children}
    </div>
  );
}

function TimelineItem({
  label,
  timestamp,
  actor,
  avatar,
  reason,
}: {
  label: string;
  timestamp: Date | Timestamp | string;
  actor?: string;  // The actor name (Bot, System, or human name) - "by" prefix is added automatically
  avatar?: string | 'bot' | 'system';  // URL to avatar image, 'bot' for robot emoji, or 'system' for gear icon
  reason?: string;  // Explanation for why this happened
}) {
  return (
    <div className="flex gap-3">
      <div
        className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5 bg-muted-foreground"
      />
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-foreground" style={{ fontSize: '13px' }}>{label}</span>
          <span className="text-muted-foreground/50" style={{ fontSize: '12px' }}>·</span>
          <Attribution date={timestamp} />
          {actor && (
            <span className="flex items-center gap-1.5" style={{ fontSize: '12px' }}>
              <span className="text-muted-foreground">by</span>
              {avatar === 'bot' ? (
                <span style={{ fontSize: '14px' }}>🤖</span>
              ) : avatar === 'system' ? (
                <span style={{ fontSize: '12px' }}>⚙️</span>
              ) : avatar ? (
                <img
                  src={avatar}
                  alt=""
                  className="w-4 h-4 rounded-full"
                  style={{ objectFit: 'cover' }}
                />
              ) : null}
              <span className="text-foreground">{actor}</span>
            </span>
          )}
        </div>
        {reason && (
          <p className="text-muted-foreground" style={{ fontSize: '11px' }}>
            {reason}
          </p>
        )}
      </div>
    </div>
  );
}

// Helper to get RGB color values for classifications
function getClassificationColor(classification: Classification): string {
  const colors: Record<Classification, string> = {
    'high-quality': '34, 197, 94',      // emerald-500
    'low-quality': '161, 161, 161',     // gray
    'support': '59, 130, 246',          // blue-500
    'existing': '168, 85, 247',         // purple-500
  };
  return colors[classification] || '161, 161, 161';
}

function ClassificationBadge({ lead, onReclassify }: { lead: Lead; onReclassify: (newClassification: Classification) => void }) {
  const classification = getCurrentClassification(lead);
  if (!classification) return null;

  const display = getClassificationDisplay(classification);
  const colors = {
    background: `rgba(${parseInt(display.color.slice(1, 3), 16)}, ${parseInt(display.color.slice(3, 5), 16)}, ${parseInt(display.color.slice(5, 7), 16)}, 0.1)`,
    text: display.color,
    border: `rgba(${parseInt(display.color.slice(1, 3), 16)}, ${parseInt(display.color.slice(3, 5), 16)}, ${parseInt(display.color.slice(5, 7), 16)}, 0.2)`,
  };

  const otherClassifications = (Object.keys(CLASSIFICATIONS) as Classification[]).filter(
    (key) => key !== classification
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border cursor-pointer transition-opacity hover:opacity-80"
          style={{
            fontSize: '12px',
            fontWeight: 500,
            backgroundColor: colors.background,
            color: colors.text,
            borderColor: colors.border,
          }}
        >
          {display.label}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {otherClassifications.map((key) => {
          const config = CLASSIFICATIONS[key];
          return (
            <DropdownMenuItem
              key={key}
              onClick={() => onReclassify(key)}
              className="flex items-center gap-2"
            >
              <span style={{ color: config.colors.text }}>{config.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


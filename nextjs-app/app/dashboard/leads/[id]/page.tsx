'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firestore';
import type { Lead, Classification, Configuration } from '@/lib/types';
import { getCurrentClassification, getTerminalState, DEFAULT_CONFIGURATION, getTerminalStateDisplay, getClassificationDisplay, CLASSIFICATIONS, getClassificationAction, getClassificationLabel } from '@/lib/types';
import { assembleEmail, extractFirstName, type EmailTemplateParts } from '@/lib/email-helpers';
import { Attribution } from '@/components/shared/Attribution';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Check, X, ArrowRight, AlertCircle, Linkedin } from 'lucide-react';

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

  // Email editing state
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editedBody, setEditedBody] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Fetch configuration for email templates
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setConfiguration(data))
      .catch(err => console.error('Failed to fetch configuration:', err));
  }, []);

  // Get the appropriate email template based on classification (high-quality only)
  const getEmailTemplate = (): EmailTemplateParts | null => {
    if (!lead || !configuration) return null;
    const classification = getCurrentClassification(lead);
    const defaultTemplates = DEFAULT_CONFIGURATION.emailTemplates;

    if (classification === 'high-quality') {
      const t = configuration.emailTemplates?.highQuality || defaultTemplates.highQuality;
      return {
        greeting: t.greeting,
        callToAction: t.callToAction,
        signOff: t.signOff,
        senderName: configuration.sdr?.name || DEFAULT_CONFIGURATION.sdr.name,
        senderEmail: configuration.sdr?.email || DEFAULT_CONFIGURATION.sdr.email,
      };
    }
    // Low-quality leads use static template - no assembly needed
    return null;
  };

  // Get the AI-generated body content (high-quality only)
  const getBodyContent = (): string | null => {
    if (!lead) return null;
    // Human edits currently store full email, so use as-is for now
    if (lead.human_edits?.versions[0]?.text) {
      return lead.human_edits.versions[0].text;
    }
    // Only high-quality leads have AI-generated body content
    return lead.bot_text?.highQualityText || null;
  };

  // Get the full assembled email for display (high-quality only)
  const getAssembledEmail = (): string | null => {
    if (!lead || !configuration) return null;

    // Only high-quality leads have assembled emails
    const bodyContent = getBodyContent();
    if (!bodyContent) return null;

    // If human edited, they edited the full email, so return as-is
    if (lead.human_edits?.versions[0]?.text) {
      return lead.human_edits.versions[0].text;
    }

    // Assemble from template + body
    const template = getEmailTemplate();
    if (!template) return bodyContent; // Fallback to just body if no template

    const firstName = extractFirstName(lead.submission.leadName);
    return assembleEmail(bodyContent, template, firstName, lead.id);
  };

  // Check if this is a high-quality lead with email content to review
  const hasHighQualityEmail = (): boolean => {
    if (!lead) return false;
    const classification = getCurrentClassification(lead);
    if (classification !== 'high-quality') return false;
    return !!(lead.bot_text?.highQualityText || lead.human_edits?.versions[0]?.text);
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

  const handleApprove = async () => {
    try {
      await fetch(`/api/leads/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      router.push('/dashboard');
    } catch (error) {
      console.error('Error approving lead:', error);
      alert('Failed to approve lead');
    }
  };

  const handleReject = async () => {
    if (!confirm('Are you sure you want to reject this lead?')) {
      return;
    }
    try {
      await fetch(`/api/leads/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });
      router.push('/dashboard');
    } catch (error) {
      console.error('Error rejecting lead:', error);
      alert('Failed to reject lead');
    }
  };

  const handleReclassifyTo = async (newClassification: Classification) => {
    try {
      await fetch(`/api/leads/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reclassify',
          new_classification: newClassification
        }),
      });
    } catch (error) {
      console.error('Error reclassifying lead:', error);
      alert('Failed to reclassify lead');
    }
  };

  const handleForward = async (destination: 'support' | 'account_team') => {
    const destinationLabel = destination === 'support' ? 'Support' : 'Account Team';
    if (!confirm(`Forward this lead to ${destinationLabel}?`)) {
      return;
    }
    // Forward uses the same approve flow - the backend handles it based on classification
    await handleApprove();
  };

  const handleClassify = async (classification: Classification) => {
    const confirmMessages: { [key in Classification]?: string } = {
      'high-quality': 'Classify as High Quality and generate email for review?',
      'low-quality': 'Classify as Low Quality and generate email for review?',
      support: 'Classify as Support and auto-forward?',
      duplicate: 'Classify as Duplicate and forward to account team?',
      irrelevant: 'Classify as Irrelevant and close this lead?',
    };

    const message = confirmMessages[classification] || `Classify this lead as "${classification}"?`;
    if (!confirm(message)) {
      return;
    }

    setClassifying(true);
    try {
      const response = await fetch(`/api/leads/${id}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classification }),
      });

      const result = await response.json();

      if (result.success) {
        // Different behaviors based on classification
        if (classification === 'high-quality' || classification === 'low-quality') {
          // For high-quality/low-quality: Stay on page, email will be shown for review
          alert(`Lead classified as ${classification}. Review the email below and approve to send.`);
          // Lead will update via real-time listener
        } else {
          // For support/duplicate/irrelevant: Show success and redirect
          alert(`Success: ${result.message}`);
          setTimeout(() => router.push('/dashboard'), 1000);
        }
      } else {
        alert(`Error: ${result.error || 'Failed to classify lead'}`);
      }
    } catch (error) {
      console.error('Error classifying lead:', error);
      alert('Failed to classify lead');
    } finally {
      setClassifying(false);
    }
  };

  const handleEditEmail = () => {
    // Get body content for editing (not the full assembled email)
    const bodyContent = getBodyContent() || '';
    setEditedBody(bodyContent);
    setIsEditingEmail(true);
  };

  const handleCancelEdit = () => {
    setIsEditingEmail(false);
    setEditedBody('');
  };

  const handleSaveEmail = async () => {
    setSavingEmail(true);
    try {
      const response = await fetch(`/api/leads/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit',
          email_text: editedBody,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save email');
      }

      setIsEditingEmail(false);
      // Lead will update via real-time listener
    } catch (error) {
      console.error('Error saving email:', error);
      alert('Failed to save email');
    } finally {
      setSavingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="space-y-6">
          <div className="h-8 bg-[#0a0a0a] rounded-md w-1/3 animate-pulse"></div>
          <div className="h-64 bg-[#0a0a0a] rounded-md animate-pulse"></div>
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
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1
                className="font-semibold"
                style={{
                  fontSize: '24px',
                  lineHeight: '1.2',
                  color: '#fafafa',
                  fontWeight: 600
                }}
              >
                {lead.submission.company}
              </h1>
              <ClassificationBadge lead={lead} onReclassify={handleReclassifyTo} />
            </div>
            <div
              style={{
                fontSize: '13px',
                color: '#a1a1a1',
                lineHeight: '1.6'
              }}
            >
              {lead.submission.leadName}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {hasHighQualityEmail() ? (
              // Leads WITH email: Primary = Approve & Send
              <div className="inline-flex rounded-md shadow-sm">
                <Button
                  onClick={handleApprove}
                  size="sm"
                  variant="outline"
                  className="rounded-r-none border-r-0 hover:bg-[rgba(34,197,94,0.1)]"
                  style={{
                    color: '#22c55e',
                    borderColor: 'rgba(34,197,94,0.2)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Check className="h-4 w-4 mr-1.5" />
                  Approve & Send
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="rounded-l-none">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleForward('support')} className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" style={{ color: '#3b82f6' }} />
                      <span style={{ color: '#3b82f6' }}>Forward to Support</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleForward('account_team')} className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" style={{ color: '#3b82f6' }} />
                      <span style={{ color: '#3b82f6' }}>Forward to Account Team</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleReject} className="flex items-center gap-2">
                      <X className="h-4 w-4" style={{ color: '#ef4444' }} />
                      <span style={{ color: '#ef4444' }}>Reject</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : getCurrentClassification(lead) === 'low-quality' ? (
              // Low-quality leads: Primary = Reply with Generic
              <div className="inline-flex rounded-md shadow-sm">
                <Button
                  onClick={handleApprove}
                  size="sm"
                  variant="outline"
                  className="rounded-r-none border-r-0 hover:bg-[rgba(161,161,161,0.1)]"
                  style={{
                    color: CLASSIFICATIONS['low-quality'].action.color,
                    borderColor: `${CLASSIFICATIONS['low-quality'].action.color}33`,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Check className="h-4 w-4 mr-1.5" />
                  {CLASSIFICATIONS['low-quality'].action.long}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="rounded-l-none">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleForward('support')} className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" style={{ color: CLASSIFICATIONS['support'].action.color }} />
                      <span style={{ color: CLASSIFICATIONS['support'].action.color }}>{CLASSIFICATIONS['support'].action.long}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleForward('account_team')} className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" style={{ color: CLASSIFICATIONS['duplicate'].action.color }} />
                      <span style={{ color: CLASSIFICATIONS['duplicate'].action.color }}>{CLASSIFICATIONS['duplicate'].action.long}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleReject} className="flex items-center gap-2">
                      <X className="h-4 w-4" style={{ color: CLASSIFICATIONS['irrelevant'].action.color }} />
                      <span style={{ color: CLASSIFICATIONS['irrelevant'].action.color }}>{CLASSIFICATIONS['irrelevant'].action.long}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : getCurrentClassification(lead) === 'support' ? (
              // Support leads: Primary = Forward to Support
              <div className="inline-flex rounded-md shadow-sm">
                <Button
                  onClick={() => handleForward('support')}
                  size="sm"
                  variant="outline"
                  className="rounded-r-none border-r-0 hover:bg-[rgba(59,130,246,0.1)]"
                  style={{
                    color: CLASSIFICATIONS['support'].action.color,
                    borderColor: `${CLASSIFICATIONS['support'].action.color}33`,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <ArrowRight className="h-4 w-4 mr-1.5" />
                  {CLASSIFICATIONS['support'].action.long}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="rounded-l-none">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleForward('account_team')} className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" style={{ color: CLASSIFICATIONS['duplicate'].action.color }} />
                      <span style={{ color: CLASSIFICATIONS['duplicate'].action.color }}>{CLASSIFICATIONS['duplicate'].action.long}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleReject} className="flex items-center gap-2">
                      <X className="h-4 w-4" style={{ color: CLASSIFICATIONS['irrelevant'].action.color }} />
                      <span style={{ color: CLASSIFICATIONS['irrelevant'].action.color }}>{CLASSIFICATIONS['irrelevant'].action.long}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : getCurrentClassification(lead) === 'duplicate' ? (
              // Duplicate leads: Primary = Forward to Account Team
              <div className="inline-flex rounded-md shadow-sm">
                <Button
                  onClick={() => handleForward('account_team')}
                  size="sm"
                  variant="outline"
                  className="rounded-r-none border-r-0 hover:bg-[rgba(168,85,247,0.1)]"
                  style={{
                    color: CLASSIFICATIONS['duplicate'].action.color,
                    borderColor: `${CLASSIFICATIONS['duplicate'].action.color}33`,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <ArrowRight className="h-4 w-4 mr-1.5" />
                  {CLASSIFICATIONS['duplicate'].action.long}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="rounded-l-none">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleForward('support')} className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" style={{ color: CLASSIFICATIONS['support'].action.color }} />
                      <span style={{ color: CLASSIFICATIONS['support'].action.color }}>{CLASSIFICATIONS['support'].action.long}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleReject} className="flex items-center gap-2">
                      <X className="h-4 w-4" style={{ color: CLASSIFICATIONS['irrelevant'].action.color }} />
                      <span style={{ color: CLASSIFICATIONS['irrelevant'].action.color }}>{CLASSIFICATIONS['irrelevant'].action.long}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              // Irrelevant/other leads: Primary = Mark Dead
              <div className="inline-flex rounded-md shadow-sm">
                <Button
                  onClick={handleReject}
                  size="sm"
                  variant="outline"
                  className="rounded-r-none border-r-0 hover:bg-[rgba(239,68,68,0.1)]"
                  style={{
                    color: CLASSIFICATIONS['irrelevant'].action.color,
                    borderColor: `${CLASSIFICATIONS['irrelevant'].action.color}33`,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <X className="h-4 w-4 mr-1.5" />
                  {CLASSIFICATIONS['irrelevant'].action.long}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="rounded-l-none">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleForward('support')} className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" style={{ color: CLASSIFICATIONS['support'].action.color }} />
                      <span style={{ color: CLASSIFICATIONS['support'].action.color }}>{CLASSIFICATIONS['support'].action.long}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleForward('account_team')} className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" style={{ color: CLASSIFICATIONS['duplicate'].action.color }} />
                      <span style={{ color: CLASSIFICATIONS['duplicate'].action.color }}>{CLASSIFICATIONS['duplicate'].action.long}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Classification UI - Show only for leads in review without classification */}
      {lead.status.status === 'review' && lead.classifications.length === 0 && (
        <div className="mb-6">
          <Section title="Classify">

            {/* AI Prediction - Show bot research if available */}
            {lead.bot_research && (
              <div className="mb-4 pb-4 border-b border-[rgba(255,255,255,0.06)]">
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#a1a1a1' }}>
                    AI Prediction:
                  </span>
                  <ClassificationBadge lead={lead} onReclassify={handleReclassifyTo} />
                  {lead.bot_research.confidence && (
                    <span
                      className="font-mono font-semibold"
                      style={{ fontSize: '12px', color: '#a1a1a1' }}
                    >
                      {(lead.bot_research.confidence * 100).toFixed(0)}% confidence
                    </span>
                  )}
                </div>
                {lead.bot_research.reasoning && (
                  <p
                    style={{
                      fontSize: '13px',
                      color: '#d4d4d4',
                      lineHeight: '1.6',
                      fontStyle: 'italic'
                    }}
                  >
                    {lead.bot_research.reasoning}
                  </p>
                )}
                {(lead.bot_text?.highQualityText || lead.bot_text?.lowQualityText) && (
                  <div className="mt-3">
                    <h4
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#fafafa',
                        marginBottom: '6px'
                      }}
                    >
                      AI-Generated Email Preview
                    </h4>
                    <div
                      className="bg-[#000000] border border-[rgba(255,255,255,0.06)] rounded-md p-3"
                      style={{
                        fontSize: '12px',
                        color: '#a1a1a1',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '200px',
                        overflowY: 'auto'
                      }}
                    >
                      {getAssembledEmail() || lead.bot_text.highQualityText || lead.bot_text.lowQualityText}
                    </div>
                  </div>
                )}
              </div>
            )}

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
                <div style={{ fontSize: '11px', color: '#a1a1a1', fontWeight: 400 }}>
                  Strong fit, personalized meeting offer
                </div>
              </Button>

              <Button
                onClick={() => handleClassify('low-quality')}
                disabled={classifying}
                variant="outline"
                className="h-auto py-4 flex flex-col items-start text-left hover:bg-[rgba(245,158,11,0.1)]"
                style={{
                  color: '#f59e0b',
                  borderColor: 'rgba(245,158,11,0.2)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Low Quality</div>
                <div style={{ fontSize: '11px', color: '#a1a1a1', fontWeight: 400 }}>
                  Real opportunity but not a fit
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
                <div style={{ fontSize: '11px', color: '#a1a1a1', fontWeight: 400 }}>
                  Existing customer needing help
                </div>
              </Button>

              <Button
                onClick={() => handleClassify('duplicate')}
                disabled={classifying}
                variant="outline"
                className="h-auto py-4 flex flex-col items-start text-left hover:bg-[rgba(168,85,247,0.1)]"
                style={{
                  color: '#a855f7',
                  borderColor: 'rgba(168,85,247,0.2)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Duplicate</div>
                <div style={{ fontSize: '11px', color: '#a1a1a1', fontWeight: 400 }}>
                  Already a customer in CRM
                </div>
              </Button>

              <Button
                onClick={() => handleClassify('irrelevant')}
                disabled={classifying}
                variant="outline"
                className="h-auto py-4 flex flex-col items-start text-left hover:bg-[rgba(161,161,161,0.1)]"
                style={{
                  color: '#a1a1a1',
                  borderColor: 'rgba(161,161,161,0.2)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Irrelevant</div>
                <div style={{ fontSize: '11px', color: '#737373', fontWeight: 400 }}>
                  Spam/test/nonsense
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
        {/* Email - Only for high-quality leads */}
        {hasHighQualityEmail() && (
          <Section title="Email">
            {lead.human_edits && !isEditingEmail && (
              <div
                className="mb-4 bg-[#0a0a0a] border border-[rgba(59,130,246,0.2)] rounded-md p-3"
                style={{ fontSize: '12px', color: '#60a5fa' }}
              >
                This email was edited before sending
                {lead.human_edits.note && (
                  <div style={{ fontSize: '11px', color: '#93c5fd', marginTop: '4px' }}>
                    {lead.human_edits.note}
                  </div>
                )}
              </div>
            )}

            {!isEditingEmail ? (
              <>
                <div className="space-y-4">
                  <div>
                    <h4
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#fafafa',
                        marginBottom: '6px'
                      }}
                    >
                      Body
                    </h4>
                    <div
                      className="bg-[#000000] border border-[rgba(255,255,255,0.06)] rounded-md p-4"
                      style={{
                        fontSize: '13px',
                        color: '#fafafa',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {getAssembledEmail()}
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <Button
                    onClick={handleEditEmail}
                    size="sm"
                    variant="outline"
                    style={{
                      color: '#0070f3',
                      borderColor: 'rgba(0,112,243,0.2)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Edit Email
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <h4
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#fafafa',
                        marginBottom: '6px'
                      }}
                    >
                      Body
                    </h4>
                    <textarea
                      value={editedBody}
                      onChange={(e) => setEditedBody(e.target.value)}
                      rows={12}
                      className="w-full bg-[#000000] border border-[rgba(255,255,255,0.06)] rounded-md p-4"
                      style={{
                        fontSize: '13px',
                        color: '#fafafa',
                        lineHeight: '1.6',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={handleSaveEmail}
                    disabled={savingEmail}
                    size="sm"
                    style={{
                      backgroundColor: '#0070f3',
                      color: '#fff',
                      fontWeight: 500,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {savingEmail ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    onClick={handleCancelEdit}
                    disabled={savingEmail}
                    size="sm"
                    variant="outline"
                    style={{
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </Section>
        )}

        {/* Lead */}
        <Section title="Lead">
          <InfoRow
            label="Company"
            value={
              <div className="flex items-center gap-2">
                <span>{lead.submission.company}</span>
                <a
                  href={`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(lead.submission.company)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-70"
                  style={{ transition: 'opacity 0.15s ease' }}
                  title="Search Company on LinkedIn"
                >
                  <Linkedin className="h-4 w-4" style={{ color: '#0077b5' }} />
                </a>
              </div>
            }
          />
          <InfoRow
            label="Contact"
            value={
              <div className="flex items-center gap-2">
                <span>{lead.submission.leadName} &lt;{lead.submission.email}&gt;</span>
                <a
                  href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(lead.submission.leadName + ' ' + lead.submission.company)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-70"
                  style={{ transition: 'opacity 0.15s ease' }}
                  title="Search on LinkedIn"
                >
                  <Linkedin className="h-4 w-4" style={{ color: '#0077b5' }} />
                </a>
              </div>
            }
          />
          <div className="pt-3 mt-3 border-t border-[rgba(255,255,255,0.06)]">
            <div
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: '#a1a1a1',
                marginBottom: '8px'
              }}
            >
              Message
            </div>
            <div
              style={{
                fontSize: '13px',
                color: '#fafafa',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap'
              }}
            >
              {lead.submission.message}
            </div>
          </div>
        </Section>

        {/* Research & Classification */}
        {lead.bot_research && (
          <Section title="Research Report">
            {/* AI Classification Decision */}
            {getCurrentClassification(lead) && (
              <div className="mb-4 pb-4 border-b border-[rgba(255,255,255,0.06)]">
                <div className="flex items-center gap-3 mb-3">
                  <ClassificationBadge lead={lead} onReclassify={handleReclassifyTo} />
                  {lead.bot_research.confidence && (
                    <span
                      className="font-mono font-semibold"
                      style={{
                        fontSize: '14px',
                        color: '#a1a1a1'
                      }}
                    >
                      {(lead.bot_research.confidence * 100).toFixed(0)}% confidence
                    </span>
                  )}
                  {lead.bot_research.timestamp && (
                    <span style={{ marginLeft: 'auto' }}>
                      <Attribution date={lead.bot_research.timestamp} by={null} />
                    </span>
                  )}
                </div>
                {lead.bot_research.reasoning && (
                  <p
                    style={{
                      fontSize: '13px',
                      color: '#d4d4d4',
                      lineHeight: '1.6',
                      fontStyle: 'italic'
                    }}
                  >
                    {lead.bot_research.reasoning}
                  </p>
                )}
              </div>
            )}

          </Section>
        )}

        {/* Metadata */}
        <Section title="Metadata">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow label="Lead ID" value={<span className="font-mono">{lead.id}</span>} />
            <InfoRow label="Status" value={lead.status.status === 'done' ? 'Done' : 'In Review'} />
            <InfoRow
              label="Received"
              value={<Attribution date={lead.status.received_at} by={null} />}
            />
            {lead.status.sent_at && (
              <InfoRow
                label="Sent"
                value={<Attribution date={lead.status.sent_at} by={null} />}
              />
            )}
            {lead.human_edits?.versions[0]?.timestamp && (
              <InfoRow
                label="Last Edited"
                value={<Attribution date={lead.human_edits.versions[0].timestamp} by={null} />}
              />
            )}
            {lead.classifications.length > 0 && (
              <InfoRow
                label="Classifications"
                value={
                  <div className="flex flex-col gap-1">
                    {lead.classifications.map((c, i) => (
                      <div key={i} className="flex items-center gap-2" style={{ fontSize: '11px' }}>
                        <span>{c.author}: {getClassificationLabel(c.classification)}</span>
                        <Attribution date={c.timestamp} by={null} />
                      </div>
                    ))}
                  </div>
                }
              />
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="bg-[#0a0a0a] border border-[rgba(255,255,255,0.1)] rounded-md p-4"
      style={{
        transition: 'border-color 0.15s ease'
      }}
    >
      <h2
        className="font-sans"
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#fafafa',
          marginBottom: '12px'
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div
      className="py-2 border-b border-[rgba(255,255,255,0.06)] last:border-0"
      style={{ transition: 'border-color 0.15s ease' }}
    >
      <div className="flex items-start justify-between gap-4">
        <span
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: '#a1a1a1'
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: '12px',
            color: '#fafafa',
            textAlign: 'right',
            maxWidth: '28rem'
          }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div
      className="bg-[#000000] border border-[rgba(255,255,255,0.06)] rounded-md p-4"
      style={{ transition: 'border-color 0.15s ease' }}
    >
      <div
        style={{
          fontSize: '11px',
          color: '#a1a1a1',
          marginBottom: '4px'
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#fafafa'
        }}
      >
        {value}
      </div>
    </div>
  );
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
    <div className="inline-flex rounded-md shadow-sm">
      <span
        className="inline-flex items-center px-3 py-1 rounded-l-md border border-r-0"
        style={{
          fontSize: '12px',
          fontWeight: 500,
          backgroundColor: colors.background,
          color: colors.text,
          borderColor: colors.border,
          transition: 'all 0.15s ease'
        }}
      >
        {display.label}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="inline-flex items-center px-1.5 py-1 rounded-r-md border rounded-l-none cursor-pointer hover:bg-[rgba(255,255,255,0.05)]"
            style={{
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.text,
              transition: 'all 0.15s ease'
            }}
          >
            <ChevronDown className="h-3 w-3" />
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
    </div>
  );
}


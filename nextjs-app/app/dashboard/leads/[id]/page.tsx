'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firestore';
import type { Lead } from '@/lib/types';
import { Attribution } from '@/components/shared/Attribution';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Check, X, ArrowRight, RefreshCw } from 'lucide-react';
import { getOutcomeColors, getOutcomeLabel } from '@/lib/outcomes';

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

  const handleReclassify = async () => {
    if (!confirm('Re-run the AI classification workflow for this lead?')) {
      return;
    }
    try {
      await fetch(`/api/leads/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reclassify' }),
      });
      alert('Lead will be reclassified');
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
    try {
      await fetch(`/api/leads/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'forward', destination }),
      });
      router.push('/dashboard');
    } catch (error) {
      console.error('Error forwarding lead:', error);
      alert('Failed to forward lead');
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
                {lead.name}
              </h1>
              <ClassificationBadge classification={lead.classification} />
              <OutcomeBadge outcome={lead.outcome} />
            </div>
            <div
              style={{
                fontSize: '13px',
                color: '#a1a1a1',
                lineHeight: '1.6'
              }}
            >
              {lead.company} • {lead.person_job_title || 'Contact'}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {lead.generated_email_subject ? (
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
                    <DropdownMenuItem onClick={handleReclassify} className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" style={{ color: '#f59e0b' }} />
                      <span style={{ color: '#f59e0b' }}>Reclassify</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleReject} className="flex items-center gap-2">
                      <X className="h-4 w-4" style={{ color: '#ef4444' }} />
                      <span style={{ color: '#ef4444' }}>Reject</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              // Leads WITHOUT email: Primary = Confirm Dead/Reject
              <div className="inline-flex rounded-md shadow-sm">
                <Button
                  onClick={handleReject}
                  size="sm"
                  variant="outline"
                  className="rounded-r-none border-r-0 hover:bg-[rgba(239,68,68,0.1)]"
                  style={{
                    color: '#ef4444',
                    borderColor: 'rgba(239,68,68,0.2)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <X className="h-4 w-4 mr-1.5" />
                  Confirm Dead
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="rounded-l-none">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {lead.classification === 'support' ? (
                      <>
                        <DropdownMenuItem onClick={handleReclassify} className="flex items-center gap-2">
                          <Check className="h-4 w-4" style={{ color: '#22c55e' }} />
                          <span style={{ color: '#22c55e' }}>Override to Quality</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleForward('account_team')} className="flex items-center gap-2">
                          <ArrowRight className="h-4 w-4" style={{ color: '#3b82f6' }} />
                          <span style={{ color: '#3b82f6' }}>Forward to Account Team</span>
                        </DropdownMenuItem>
                      </>
                    ) : lead.classification === 'duplicate' ? (
                      <>
                        <DropdownMenuItem onClick={handleReclassify} className="flex items-center gap-2">
                          <Check className="h-4 w-4" style={{ color: '#22c55e' }} />
                          <span style={{ color: '#22c55e' }}>Override to Quality</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleForward('support')} className="flex items-center gap-2">
                          <ArrowRight className="h-4 w-4" style={{ color: '#3b82f6' }} />
                          <span style={{ color: '#3b82f6' }}>Forward to Support</span>
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={handleReclassify} className="flex items-center gap-2">
                          <Check className="h-4 w-4" style={{ color: '#22c55e' }} />
                          <span style={{ color: '#22c55e' }}>Override to Quality</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleForward('support')} className="flex items-center gap-2">
                          <ArrowRight className="h-4 w-4" style={{ color: '#3b82f6' }} />
                          <span style={{ color: '#3b82f6' }}>Forward to Support</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleForward('account_team')} className="flex items-center gap-2">
                          <ArrowRight className="h-4 w-4" style={{ color: '#3b82f6' }} />
                          <span style={{ color: '#3b82f6' }}>Forward to Account Team</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="space-y-4">
        {/* Contact Information */}
        <Section title="Contact Information">
          <InfoRow label="Name" value={lead.name} />
          <InfoRow label="Email" value={lead.email} />
          <InfoRow label="Company" value={lead.company} />
          {lead.person_job_title && (
            <InfoRow label="Job Title" value={lead.person_job_title} />
          )}
          {lead.person_linkedin_url && (
            <InfoRow
              label="LinkedIn"
              value={
                <a
                  href={lead.person_linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#0070f3', transition: 'opacity 0.15s ease' }}
                  className="hover:opacity-80"
                >
                  View Profile
                </a>
              }
            />
          )}
        </Section>

        {/* Original Message */}
        <Section title="Original Message">
          <div
            style={{
              fontSize: '13px',
              color: '#fafafa',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap'
            }}
          >
            {lead.message}
          </div>
        </Section>

        {/* Research & Classification */}
        {lead.research_report && (
          <Section title="Research Report">
            {/* AI Classification Decision */}
            {lead.classification && (
              <div className="mb-4 pb-4 border-b border-[rgba(255,255,255,0.06)]">
                <div className="flex items-center gap-3 mb-3">
                  <ClassificationBadge classification={lead.classification} />
                  {lead.confidence_score && (
                    <span
                      className="font-mono font-semibold"
                      style={{
                        fontSize: '14px',
                        color: '#a1a1a1'
                      }}
                    >
                      {(lead.confidence_score * 100).toFixed(0)}% confidence
                    </span>
                  )}
                  {lead.classified_at && (
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#737373',
                        marginLeft: 'auto'
                      }}
                    >
                      {new Date(lead.classified_at as any).toLocaleString()}
                    </span>
                  )}
                </div>
                {lead.reasoning && (
                  <p
                    style={{
                      fontSize: '13px',
                      color: '#d4d4d4',
                      lineHeight: '1.6',
                      fontStyle: 'italic'
                    }}
                  >
                    {lead.reasoning}
                  </p>
                )}
              </div>
            )}

            {/* Research Data */}
            <div
              style={{
                fontSize: '13px',
                color: '#fafafa',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap'
              }}
            >
              {lead.research_report}
            </div>
          </Section>
        )}

        {/* Generated Email */}
        {lead.generated_email_subject && (
          <Section title="Generated Email">
            {lead.edited && (
              <div
                className="mb-4 bg-[#0a0a0a] border border-[rgba(59,130,246,0.2)] rounded-md p-3"
                style={{ fontSize: '12px', color: '#60a5fa' }}
              >
                This email was edited before sending
              </div>
            )}
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
                  Subject
                </h4>
                <div
                  className="bg-[#000000] border border-[rgba(255,255,255,0.06)] rounded-md p-3 font-mono"
                  style={{
                    fontSize: '13px',
                    color: '#fafafa'
                  }}
                >
                  {lead.final_email_subject || lead.generated_email_subject}
                </div>
              </div>
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
                  {lead.final_email_body || lead.generated_email_body}
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* Error Message */}
        {lead.error_message && (
          <Section title="Error Details">
            <div
              className="bg-[#0a0a0a] border border-[rgba(239,68,68,0.2)] rounded-md p-4"
              style={{ fontSize: '14px', color: '#ef4444' }}
            >
              {lead.error_message}
            </div>
          </Section>
        )}

        {/* Metadata */}
        <Section title="Metadata">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow label="Lead ID" value={<span className="font-mono">{lead.id}</span>} />
            <InfoRow label="Outcome" value={<OutcomeBadge outcome={lead.outcome} />} />
            <InfoRow
              label="Created"
              value={<Attribution date={lead.created_at} by={null} />}
            />
            {lead.closed_at && (
              <InfoRow
                label="Closed"
                value={<Attribution date={lead.closed_at} by={lead.closed_by} />}
              />
            )}
            {lead.reviewed_at && !lead.closed_at && (
              <InfoRow
                label="Reviewed"
                value={<Attribution date={lead.reviewed_at} by={lead.reviewed_by} />}
              />
            )}
            {lead.edited_at && (
              <InfoRow
                label="Edited"
                value={<Attribution date={lead.edited_at} by={lead.edited_by} />}
              />
            )}
            {lead.configuration_id && (
              <InfoRow label="Configuration ID" value={<span className="font-mono">{lead.configuration_id}</span>} />
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

function ClassificationBadge({
  classification,
}: {
  classification: string | null;
}) {
  if (!classification) return null;

  const styles: { [key: string]: { bg: string; text: string; border: string } } = {
    quality: {
      bg: 'rgba(34,197,94,0.1)',
      text: '#22c55e',
      border: 'rgba(34,197,94,0.2)'
    },
    support: {
      bg: 'rgba(59,130,246,0.1)',
      text: '#3b82f6',
      border: 'rgba(59,130,246,0.2)'
    },
    'low-value': {
      bg: 'rgba(239,68,68,0.1)',
      text: '#ef4444',
      border: 'rgba(239,68,68,0.2)'
    },
    uncertain: {
      bg: 'rgba(245,158,11,0.1)',
      text: '#f59e0b',
      border: 'rgba(245,158,11,0.2)'
    },
    dead: {
      bg: 'rgba(161,161,161,0.1)',
      text: '#a1a1a1',
      border: 'rgba(161,161,161,0.2)'
    },
    duplicate: {
      bg: 'rgba(168,85,247,0.1)',
      text: '#a855f7',
      border: 'rgba(168,85,247,0.2)'
    },
  };

  const style = styles[classification] || styles.dead;

  return (
    <span
      className="inline-flex px-3 py-1 rounded-md border"
      style={{
        fontSize: '12px',
        fontWeight: 500,
        backgroundColor: style.bg,
        color: style.text,
        borderColor: style.border,
        transition: 'all 0.15s ease'
      }}
    >
      {classification.charAt(0).toUpperCase() + classification.slice(1)}
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: any }) {
  const colors = getOutcomeColors(outcome);
  const label = getOutcomeLabel(outcome);

  return (
    <span
      className="inline-flex px-3 py-1 rounded-md border"
      style={{
        fontSize: '12px',
        fontWeight: 500,
        backgroundColor: colors.background,
        color: colors.text,
        borderColor: colors.border,
        transition: 'all 0.15s ease'
      }}
    >
      {label}
    </span>
  );
}

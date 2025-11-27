'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AnalyticsData {
  totalLeads: number;
  leadsInReview: number;
  leadsDone: number;
  sentMeetingOffer: number;
  sentGeneric: number;
  forwardedSupport: number;
  forwardedAccountTeam: number;
  dead: number;
  classificationBreakdown: {
    'high-quality': number;
    'low-quality': number;
    support: number;
    duplicate: number;
    irrelevant: number;
  };
  autoSendRate: number;
  humanOverrideRate: number;
  botAccuracy: number;
  avgConfidence: number;
  confidenceByClassification: {
    classification: string;
    avgConfidence: number;
    count: number;
  }[];
  avgProcessingTimeMs: number;
  avgTimeToSendMs: number;
  avgTimeToMeetingMs: number;
  meetingsBooked: number;
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics/overview');
      const data = await response.json();

      if (data.success) {
        setAnalytics(data.analytics);
      } else {
        setError(data.error || 'Failed to load analytics');
      }
    } catch (err) {
      setError('Failed to load analytics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-[#1a1a1a] rounded w-32"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 bg-[#1a1a1a] rounded-lg border border-[rgba(255,255,255,0.1)]"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 bg-[#1a1a1a] rounded-lg border border-[rgba(255,255,255,0.1)]"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <p className="text-red-400 text-sm">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-8">
        <Card className="border-[rgba(255,255,255,0.1)]">
          <CardContent className="p-8 text-center">
            <p className="text-[#fafafa] text-base mb-2">No analytics data available yet</p>
            <p className="text-[#666] text-sm">
              Submit some leads to start tracking metrics.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#fafafa] tracking-tight">Analytics</h1>
        <p className="text-sm text-[#666] mt-1">Overview of lead processing and bot performance</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Leads"
          value={analytics.totalLeads}
          subtext={`${analytics.leadsInReview} in review`}
        />
        <StatCard
          label="Emails Sent"
          value={analytics.sentMeetingOffer + analytics.sentGeneric}
          subtext={`${analytics.sentMeetingOffer} meeting offers`}
          variant="success"
        />
        <StatCard
          label="Forwarded"
          value={analytics.forwardedSupport + analytics.forwardedAccountTeam}
          subtext={`${analytics.forwardedSupport} support, ${analytics.forwardedAccountTeam} account`}
        />
        <StatCard
          label="Dead / Irrelevant"
          value={analytics.dead}
          subtext="No action taken"
          variant="muted"
        />
      </div>

      {/* Bot Performance */}
      <div>
        <h2 className="text-lg font-medium text-[#fafafa] mb-4">Bot Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            label="Auto-send Rate"
            value={`${analytics.autoSendRate.toFixed(1)}%`}
            subtext="Processed without review"
            variant={analytics.autoSendRate > 50 ? 'success' : 'default'}
          />
          <StatCard
            label="Human Override Rate"
            value={`${analytics.humanOverrideRate.toFixed(1)}%`}
            subtext="Reclassified by humans"
            variant={analytics.humanOverrideRate > 20 ? 'warning' : 'default'}
          />
          <StatCard
            label="Bot Accuracy"
            value={`${analytics.botAccuracy.toFixed(1)}%`}
            subtext="On reviewed leads"
            variant={analytics.botAccuracy > 80 ? 'success' : analytics.botAccuracy > 60 ? 'warning' : 'error'}
          />
        </div>
      </div>

      {/* Classification Breakdown & Confidence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Classification Breakdown */}
        <Card className="border-[rgba(255,255,255,0.1)] bg-[#0a0a0a]">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium text-[#fafafa]">Classification Breakdown</CardTitle>
            <CardDescription className="text-[#666]">Current classification distribution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ClassificationBar
              label="High Quality"
              count={analytics.classificationBreakdown['high-quality']}
              total={analytics.totalLeads}
              color="bg-emerald-500"
            />
            <ClassificationBar
              label="Low Quality"
              count={analytics.classificationBreakdown['low-quality']}
              total={analytics.totalLeads}
              color="bg-amber-500"
            />
            <ClassificationBar
              label="Support"
              count={analytics.classificationBreakdown.support}
              total={analytics.totalLeads}
              color="bg-blue-500"
            />
            <ClassificationBar
              label="Duplicate"
              count={analytics.classificationBreakdown.duplicate}
              total={analytics.totalLeads}
              color="bg-purple-500"
            />
            <ClassificationBar
              label="Irrelevant"
              count={analytics.classificationBreakdown.irrelevant}
              total={analytics.totalLeads}
              color="bg-[#444]"
            />
          </CardContent>
        </Card>

        {/* Confidence by Classification */}
        <Card className="border-[rgba(255,255,255,0.1)] bg-[#0a0a0a]">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium text-[#fafafa]">Confidence by Classification</CardTitle>
            <CardDescription className="text-[#666]">
              Average: <span className="text-[#fafafa] font-mono">{(analytics.avgConfidence * 100).toFixed(1)}%</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {analytics.confidenceByClassification.length === 0 ? (
              <p className="text-[#666] text-sm">No confidence data yet</p>
            ) : (
              analytics.confidenceByClassification.map(({ classification, avgConfidence, count }) => (
                <ConfidenceBar
                  key={classification}
                  label={formatClassification(classification)}
                  confidence={avgConfidence}
                  count={count}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timing Metrics */}
      <div>
        <h2 className="text-lg font-medium text-[#fafafa] mb-4">Processing Times</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-[rgba(255,255,255,0.1)] bg-[#0a0a0a]">
            <CardContent className="p-6">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-[#666]">Avg Processing Time</span>
                <span className="text-2xl font-semibold text-[#fafafa] font-mono">
                  {formatTime(analytics.avgProcessingTimeMs)}
                </span>
              </div>
              <p className="text-xs text-[#444] mt-2">Submission to classification</p>
            </CardContent>
          </Card>
          <Card className="border-[rgba(255,255,255,0.1)] bg-[#0a0a0a]">
            <CardContent className="p-6">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-[#666]">Avg Time to Send</span>
                <span className="text-2xl font-semibold text-[#fafafa] font-mono">
                  {formatTime(analytics.avgTimeToSendMs)}
                </span>
              </div>
              <p className="text-xs text-[#444] mt-2">Submission to email sent</p>
            </CardContent>
          </Card>
          <Card className="border-[rgba(255,255,255,0.1)] bg-[#0a0a0a]">
            <CardContent className="p-6">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-[#666]">Avg Time to Meeting</span>
                <span className="text-2xl font-semibold text-[#fafafa] font-mono">
                  {formatTime(analytics.avgTimeToMeetingMs)}
                </span>
              </div>
              <p className="text-xs text-[#444] mt-2">
                Email sent to meeting booked ({analytics.meetingsBooked} total)
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtext,
  variant = 'default',
}: {
  label: string;
  value: string | number;
  subtext?: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'muted';
}) {
  const variantStyles = {
    default: 'border-[rgba(255,255,255,0.1)] bg-[#0a0a0a]',
    success: 'border-emerald-500/20 bg-emerald-500/5',
    warning: 'border-amber-500/20 bg-amber-500/5',
    error: 'border-red-500/20 bg-red-500/5',
    muted: 'border-[rgba(255,255,255,0.05)] bg-[#050505]',
  };

  const valueColors = {
    default: 'text-[#fafafa]',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    error: 'text-red-400',
    muted: 'text-[#888]',
  };

  return (
    <Card className={variantStyles[variant]}>
      <CardContent className="p-5">
        <p className="text-xs font-medium text-[#666] uppercase tracking-wide mb-2">{label}</p>
        <p className={`text-3xl font-semibold ${valueColors[variant]} font-mono tabular-nums`}>
          {value}
        </p>
        {subtext && (
          <p className="text-xs text-[#444] mt-2">{subtext}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ClassificationBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-[#a1a1a1]">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-[#fafafa] tabular-nums">{count}</span>
          <Badge variant="secondary" className="text-[10px] font-mono bg-[#1a1a1a] text-[#666] border-none">
            {percentage.toFixed(1)}%
          </Badge>
        </div>
      </div>
      <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function ConfidenceBar({
  label,
  confidence,
  count,
}: {
  label: string;
  confidence: number;
  count: number;
}) {
  const percentage = confidence * 100;
  const color = confidence >= 0.9 ? 'bg-emerald-500' : confidence >= 0.7 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#a1a1a1]">{label}</span>
          <span className="text-xs text-[#444] font-mono">({count})</span>
        </div>
        <span className="text-sm font-mono text-[#fafafa] tabular-nums">{percentage.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function formatClassification(classification: string): string {
  return classification
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatTime(ms: number): string {
  if (!ms || ms === 0) return 'N/A';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

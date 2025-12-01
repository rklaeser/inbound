'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface HumanAIComparisonStats {
  totalComparisons: number;
  agreements: number;
  disagreements: number;
  agreementRate: number;
  byComparisonType: {
    blind: { total: number; agreements: number; agreementRate: number };
    override: { total: number; agreements: number; agreementRate: number };
  };
  byConfidenceBucket: {
    bucket: string;
    total: number;
    agreements: number;
    agreementRate: number;
  }[];
  byClassification: {
    classification: string;
    total: number;
    agreements: number;
    agreementRate: number;
  }[];
  confusionMatrix: {
    aiClassification: string;
    humanClassification: string;
    count: number;
  }[];
}

interface AnalyticsData {
  totalLeads: number;
  leadsInReview: number;
  leadsDone: number;
  sentMeetingOffer: number;
  sentGeneric: number;
  forwardedSupport: number;
  forwardedAccountTeam: number;
  customerReroutes: number;
  supportReroutes: number;
  salesReroutes: number;
  classificationBreakdown: {
    'high-quality': number;
    'low-quality': number;
    support: number;
    duplicate: number;
    'customer-reroute': number;
    'support-reroute': number;
    'sales-reroute': number;
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
  humanAIComparison: HumanAIComparisonStats | null;
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
          label="Generic Emails"
          value={analytics.sentGeneric}
          subtext="Low-quality leads"
          variant="muted"
        />
      </div>

      {/* Processing Times */}
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

      {/* Reroutes */}
      {(analytics.customerReroutes > 0 || analytics.supportReroutes > 0 || analytics.salesReroutes > 0) && (
        <div>
          <h2 className="text-lg font-medium text-[#fafafa] mb-4">Reroutes</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              label="Customer Reroutes"
              value={analytics.customerReroutes}
              subtext="Customer disputed classification"
              variant={analytics.customerReroutes > 0 ? 'warning' : 'default'}
            />
            <StatCard
              label="Support Reroutes"
              value={analytics.supportReroutes}
              subtext="Support team sent back"
              variant={analytics.supportReroutes > 0 ? 'warning' : 'default'}
            />
            <StatCard
              label="Sales Reroutes"
              value={analytics.salesReroutes}
              subtext="Sales team sent back"
              variant={analytics.salesReroutes > 0 ? 'warning' : 'default'}
            />
          </div>
        </div>
      )}

      {/* Human vs AI Comparison */}
      {analytics.humanAIComparison && analytics.humanAIComparison.totalComparisons > 0 && (
        <div>
          <h2 className="text-lg font-medium text-[#fafafa] mb-4">Human vs AI Classification Comparison</h2>

          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total Comparisons"
              value={analytics.humanAIComparison.totalComparisons}
              subtext="Leads where human classified"
            />
            <StatCard
              label="Agreement Rate"
              value={`${analytics.humanAIComparison.agreementRate}%`}
              subtext={`${analytics.humanAIComparison.agreements} agreements`}
              variant={analytics.humanAIComparison.agreementRate >= 80 ? 'success' : analytics.humanAIComparison.agreementRate >= 60 ? 'warning' : 'error'}
            />
            <StatCard
              label="Blind Agreement"
              value={`${analytics.humanAIComparison.byComparisonType.blind.agreementRate}%`}
              subtext={`${analytics.humanAIComparison.byComparisonType.blind.total} samples`}
              variant={analytics.humanAIComparison.byComparisonType.blind.agreementRate >= 80 ? 'success' : 'default'}
            />
            <StatCard
              label="Override Agreement"
              value={`${analytics.humanAIComparison.byComparisonType.override.agreementRate}%`}
              subtext={`${analytics.humanAIComparison.byComparisonType.override.total} samples`}
              variant={analytics.humanAIComparison.byComparisonType.override.agreementRate >= 80 ? 'success' : 'default'}
            />
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Agreement by Confidence */}
            <Card className="border-[rgba(255,255,255,0.1)] bg-[#0a0a0a]">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-medium text-[#fafafa]">Agreement by AI Confidence</CardTitle>
                <CardDescription className="text-[#666]">Does higher confidence correlate with human agreement?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analytics.humanAIComparison.byConfidenceBucket.length === 0 ? (
                  <p className="text-[#666] text-sm">No data yet</p>
                ) : (
                  analytics.humanAIComparison.byConfidenceBucket.map(({ bucket, total, agreements, agreementRate }) => (
                    <AgreementBar
                      key={bucket}
                      label={bucket}
                      agreementRate={agreementRate}
                      count={total}
                      agreements={agreements}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            {/* Agreement by Classification */}
            <Card className="border-[rgba(255,255,255,0.1)] bg-[#0a0a0a]">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-medium text-[#fafafa]">Agreement by Classification</CardTitle>
                <CardDescription className="text-[#666]">Which classifications do humans agree with most?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analytics.humanAIComparison.byClassification.length === 0 ? (
                  <p className="text-[#666] text-sm">No data yet</p>
                ) : (
                  analytics.humanAIComparison.byClassification.map(({ classification, total, agreements, agreementRate }) => (
                    <AgreementBar
                      key={classification}
                      label={formatClassification(classification)}
                      agreementRate={agreementRate}
                      count={total}
                      agreements={agreements}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Confusion Matrix */}
          {analytics.humanAIComparison.confusionMatrix.length > 0 && (
            <Card className="border-[rgba(255,255,255,0.1)] bg-[#0a0a0a] mt-6">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-medium text-[#fafafa]">Classification Confusion Matrix</CardTitle>
                <CardDescription className="text-[#666]">When AI and human disagree, what do they each choose?</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[rgba(255,255,255,0.1)]">
                        <th className="text-left py-2 px-3 text-[#666] font-medium">AI Classification</th>
                        <th className="text-left py-2 px-3 text-[#666] font-medium">Human Classification</th>
                        <th className="text-right py-2 px-3 text-[#666] font-medium">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.humanAIComparison.confusionMatrix.map(({ aiClassification, humanClassification, count }, i) => (
                        <tr key={i} className="border-b border-[rgba(255,255,255,0.05)]">
                          <td className="py-2 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getClassificationStyle(aiClassification)}`}>
                              {formatClassification(aiClassification)}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getClassificationStyle(humanClassification)}`}>
                              {formatClassification(humanClassification)}
                            </span>
                            {aiClassification === humanClassification && (
                              <span className="ml-2 text-emerald-500 text-xs">✓ Match</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[#fafafa]">{count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

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
              color="bg-gray-500"
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
              label="Customer Reroute"
              count={analytics.classificationBreakdown['customer-reroute']}
              total={analytics.totalLeads}
              color="bg-amber-500"
            />
            <ClassificationBar
              label="Support Reroute"
              count={analytics.classificationBreakdown['support-reroute']}
              total={analytics.totalLeads}
              color="bg-cyan-500"
            />
            <ClassificationBar
              label="Sales Reroute"
              count={analytics.classificationBreakdown['sales-reroute']}
              total={analytics.totalLeads}
              color="bg-pink-500"
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

function AgreementBar({
  label,
  agreementRate,
  count,
  agreements,
}: {
  label: string;
  agreementRate: number;
  count: number;
  agreements: number;
}) {
  const color = agreementRate >= 80 ? 'bg-emerald-500' : agreementRate >= 60 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#a1a1a1]">{label}</span>
          <span className="text-xs text-[#444] font-mono">({agreements}/{count})</span>
        </div>
        <span className="text-sm font-mono text-[#fafafa] tabular-nums">{agreementRate}%</span>
      </div>
      <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${agreementRate}%` }}
        />
      </div>
    </div>
  );
}

function getClassificationStyle(classification: string): string {
  const styles: Record<string, string> = {
    'high-quality': 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    'low-quality': 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
    'support': 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    'duplicate': 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    'customer-reroute': 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    'support-reroute': 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
    'sales-reroute': 'bg-pink-500/10 text-pink-400 border border-pink-500/20',
  };
  return styles[classification] || 'bg-[#1a1a1a] text-[#666] border border-[rgba(255,255,255,0.1)]';
}

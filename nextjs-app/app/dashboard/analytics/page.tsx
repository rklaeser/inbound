'use client';

import { useEffect, useState } from 'react';

interface DeploymentMetrics {
  [key: string]: any;
}

interface Deployment {
  [key: string]: any;
}

interface AnalyticsOverview {
  total_leads: number;
  total_emails_generated: number;
  total_emails_sent: number;
  overall_approval_rate: number;
  deployments_count: number;
  total_meetings_booked?: number;
  avg_time_to_booking_ms?: number | null;
  total_rerouted?: number;
}

interface ActiveConfiguration {
  id: string;
  name: string;
  version: number;
  status: string;
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [deploymentMetrics, setDeploymentMetrics] = useState<DeploymentMetrics[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [activeConfiguration, setActiveConfiguration] = useState<ActiveConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
    fetchDeployments();
    fetchActiveConfiguration();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics/overview');
      const data = await response.json();

      if (data.success) {
        setOverview(data.overview);
        setDeploymentMetrics(data.deployments);
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

  const fetchDeployments = async () => {
    try {
      const response = await fetch('/api/deployments');
      const data = await response.json();

      if (data.success) {
        setDeployments(data.deployments);
      }
    } catch (err) {
      console.error('Failed to load deployments:', err);
    }
  };

  const fetchActiveConfiguration = async () => {
    try {
      const response = await fetch('/api/configurations');
      const data = await response.json();

      if (data.success) {
        const active = data.configurations?.find((c: any) => c.status === 'active');
        if (active) {
          setActiveConfiguration(active);
        }
      }
    } catch (err) {
      console.error('Failed to load active configuration:', err);
    }
  };

  const getDeploymentName = (deploymentId: string) => {
    const deployment = deployments.find(d => d.id === deploymentId);
    return deployment ? deployment.name : `v${deploymentMetrics.find(m => m.configuration_id === deploymentId)?.deployment_version || '?'}`;
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Current Configuration Banner */}
      {activeConfiguration && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-blue-900">Current Configuration</h3>
              <p className="text-lg font-semibold text-blue-700 mt-1">
                {activeConfiguration.name} <span className="text-sm font-normal text-blue-600">(v{activeConfiguration.version})</span>
              </p>
            </div>
            <div className="text-sm text-blue-600">
              <a href="/dashboard/configurations" className="hover:underline">
                Manage Configurations →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Overview Cards */}
      {overview && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <MetricCard
              title="Total Leads"
              value={overview.total_leads}
              icon="📊"
            />
            <MetricCard
              title="Emails Generated"
              value={overview.total_emails_generated}
              icon="✉️"
            />
            <MetricCard
              title="Emails Sent"
              value={overview.total_emails_sent}
              icon="📤"
            />
            <MetricCard
              title="Approval Rate"
              value={`${overview.overall_approval_rate.toFixed(1)}%`}
              icon="✅"
              highlight
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <MetricCard
              title="Meetings Booked"
              value={overview.total_meetings_booked || 0}
              icon="📅"
            />
            <MetricCard
              title="Avg Time to Booking"
              value={overview.avg_time_to_booking_ms ? formatResponseTime(overview.avg_time_to_booking_ms) : 'N/A'}
              icon="⏱️"
            />
            <MetricCard
              title="Rerouted Emails"
              value={overview.total_rerouted || 0}
              icon="↩️"
              isNegative
            />
          </div>
        </>
      )}

      {/* Deployment Comparison */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Deployment Comparison</h2>

        {deploymentMetrics.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600">No deployment data available yet.</p>
            <p className="text-sm text-gray-500 mt-2">
              Create and deploy a configuration to start tracking metrics.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Deployment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Leads
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Generated
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Approval Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Edit Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Response
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {deploymentMetrics.map((metrics) => (
                    <tr
                      key={metrics.configuration_id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => window.location.href = `/dashboard/deployments/${metrics.configuration_id}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {getDeploymentName(metrics.configuration_id)}
                            </div>
                            <div className="text-xs text-gray-500">
                              v{metrics.deployment_version}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {metrics.total_leads}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {metrics.emails_generated}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {metrics.emails_sent}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${
                          metrics.approval_rate >= 70 ? 'text-green-600' :
                          metrics.approval_rate >= 50 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {metrics.approval_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${
                          metrics.edit_rate <= 30 ? 'text-green-600' :
                          metrics.edit_rate <= 50 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {metrics.edit_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatResponseTime(metrics.avg_response_time_ms)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Trend Visualization */}
      {deploymentMetrics.length > 1 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Performance Trends</h2>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <TrendChart deploymentMetrics={deploymentMetrics} deployments={deployments} />
          </div>
        </div>
      )}

      {/* Classification Breakdown */}
      {deploymentMetrics.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Classification Distribution</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {deploymentMetrics.map((metrics) => (
              <ClassificationCard
                key={metrics.configuration_id}
                deploymentName={getDeploymentName(metrics.configuration_id)}
                version={metrics.deployment_version}
                breakdown={metrics.classification_breakdown}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  highlight = false,
  isNegative = false
}: {
  title: string;
  value: string | number;
  icon: string;
  highlight?: boolean;
  isNegative?: boolean;
}) {
  const borderColor = highlight ? 'border-blue-300' : isNegative ? 'border-red-200' : 'border-gray-200';
  const bgColor = highlight ? 'bg-blue-50' : isNegative ? 'bg-red-50' : 'bg-white';
  const textColor = highlight ? 'text-blue-700' : isNegative ? 'text-red-700' : 'text-gray-900';

  return (
    <div className={`border rounded-lg p-6 ${borderColor} ${bgColor}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-gray-400 text-sm font-medium">{title}</span>
      </div>
      <div className={`text-3xl font-bold ${textColor}`}>
        {value}
      </div>
    </div>
  );
}

function TrendChart({
  deploymentMetrics,
  deployments
}: {
  deploymentMetrics: DeploymentMetrics[];
  deployments: Deployment[];
}) {
  const getDeploymentName = (deploymentId: string) => {
    const deployment = deployments.find(d => d.id === deploymentId);
    return deployment ? deployment.name : `v${deploymentMetrics.find(m => m.configuration_id === deploymentId)?.deployment_version || '?'}`;
  };

  // Find max values for scaling
  const maxApprovalRate = Math.max(...deploymentMetrics.map(m => m.approval_rate));
  const maxEditRate = Math.max(...deploymentMetrics.map(m => m.edit_rate));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Approval Rate by Deployment</h3>
        <div className="space-y-3">
          {deploymentMetrics.map((metrics) => (
            <div key={metrics.configuration_id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">
                  {getDeploymentName(metrics.configuration_id)}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {metrics.approval_rate.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${(metrics.approval_rate / 100) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Edit Rate by Deployment</h3>
        <div className="space-y-3">
          {deploymentMetrics.map((metrics) => (
            <div key={metrics.configuration_id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">
                  {getDeploymentName(metrics.configuration_id)}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {metrics.edit_rate.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all"
                  style={{ width: `${(metrics.edit_rate / 100) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClassificationCard({
  deploymentName,
  version,
  breakdown,
}: {
  deploymentName: string;
  version: number;
  breakdown: {
    quality: number;
    support: number;
    'low-value': number;
    uncertain: number;
    dead: number;
    duplicate: number;
  };
}) {
  const total = Object.values(breakdown).reduce((sum, count) => sum + count, 0);

  const classificationColors: { [key: string]: string } = {
    quality: 'bg-green-500',
    support: 'bg-blue-500',
    'low-value': 'bg-red-500',
    uncertain: 'bg-yellow-500',
    dead: 'bg-gray-500',
    duplicate: 'bg-purple-500',
  };

  const classificationLabels: { [key: string]: string } = {
    quality: 'Quality',
    support: 'Support',
    'low-value': 'Low Value',
    uncertain: 'Uncertain',
    dead: 'Dead',
    duplicate: 'Duplicate',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="font-medium text-gray-900 mb-1">{deploymentName}</h3>
      <p className="text-xs text-gray-500 mb-4">v{version} • {total} leads</p>

      <div className="space-y-2">
        {Object.entries(breakdown).map(([classification, count]) => {
          const percentage = total > 0 ? (count / total) * 100 : 0;

          return count > 0 ? (
            <div key={classification}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600">{classificationLabels[classification]}</span>
                <span className="text-gray-900 font-medium">
                  {count} ({percentage.toFixed(0)}%)
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className={`${classificationColors[classification]} h-1.5 rounded-full transition-all`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          ) : null;
        })}
      </div>
    </div>
  );
}

function formatResponseTime(ms: number): string {
  const minutes = Math.floor(ms / 1000 / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else {
    return `${minutes}m`;
  }
}

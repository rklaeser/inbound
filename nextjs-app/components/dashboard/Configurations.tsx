'use client';

import { useEffect, useState } from 'react';
import type { Configuration, ConfigurationMetrics, Lead } from '@/lib/types';

export default function Configurations() {
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'draft' | 'active' | 'archived'>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);

  // Detail view state
  const [selectedConfigurationId, setSelectedConfigurationId] = useState<string | null>(null);
  const [selectedConfiguration, setSelectedConfiguration] = useState<Configuration | null>(null);
  const [configurationMetrics, setConfigurationMetrics] = useState<ConfigurationMetrics | null>(null);
  const [configurationLeads, setConfigurationLeads] = useState<Lead[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'config' | 'leads'>('overview');

  // Editor state
  const [autoRejectThreshold, setAutoRejectThreshold] = useState(0.9);
  const [qualityThreshold, setQualityThreshold] = useState(0.7);

  useEffect(() => {
    fetchConfigurations();
  }, [filter]);

  const fetchConfigurations = async () => {
    try {
      setLoading(true);
      const url = filter === 'all'
        ? '/api/configurations'
        : `/api/configurations?status=${filter}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setConfigurations(data.configurations);
      } else {
        setError(data.error || 'Failed to load configurations');
      }
    } catch (err) {
      setError('Failed to load configurations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (id: string) => {
    if (!confirm('Activate this configuration? It will become active for all new leads.')) {
      return;
    }

    try {
      const response = await fetch(`/api/configurations/${id}/activate`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        alert('Configuration activated successfully!');
        fetchConfigurations();
      } else {
        alert(data.error || 'Failed to activate');
      }
    } catch (err) {
      alert('Failed to activate');
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this draft configuration? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/configurations/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        alert('Configuration deleted successfully');
        fetchConfigurations();
      } else {
        alert(data.error || 'Failed to delete configuration');
      }
    } catch (err) {
      alert('Failed to delete configuration');
      console.error(err);
    }
  };

  const handleNewConfiguration = async () => {
    // Load defaults from active configuration
    try {
      const response = await fetch('/api/configurations?status=active');
      const data = await response.json();

      if (data.success && data.configurations.length > 0) {
        const activeConfiguration = data.configurations[0];
        setAutoRejectThreshold(activeConfiguration.settings.autoDeadLowValueThreshold);
        setQualityThreshold(activeConfiguration.settings.qualityLeadConfidenceThreshold);
      }
    } catch (err) {
      console.error('Error loading defaults:', err);
    }

    setShowEditor(true);
  };

  const handleClone = (configuration: Configuration) => {
    setAutoRejectThreshold(configuration.settings.autoDeadLowValueThreshold);
    setQualityThreshold(configuration.settings.qualityLeadConfidenceThreshold);
    setShowEditor(true);
  };

  const handleViewConfiguration = async (id: string) => {
    setSelectedConfigurationId(id);
    setDetailLoading(true);
    setDetailError(null);

    try {
      // Fetch configuration details and metrics
      const response = await fetch(`/api/analytics/configurations/${id}`);

      // Check if response is OK and is JSON
      if (!response.ok) {
        const text = await response.text();
        console.error('API Error Response:', text);
        setDetailError(`Failed to load configuration details (${response.status})`);
        return;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON Response:', text);
        setDetailError('Server returned an invalid response. Please check the console for details.');
        return;
      }

      const data = await response.json();

      if (data.success) {
        setSelectedConfiguration(data.configuration);
        setConfigurationMetrics(data.metrics);
      } else {
        setDetailError(data.error || 'Failed to load configuration details');
      }

      // Fetch leads for this configuration
      const leadsResponse = await fetch('/api/leads');

      if (!leadsResponse.ok) {
        console.warn('Failed to load leads, but continuing with configuration details');
      } else {
        const leadsData = await leadsResponse.json();
        if (leadsData.success) {
          const filteredLeads = leadsData.leads.filter(
            (lead: Lead) => lead.configuration_id === id
          );
          setConfigurationLeads(filteredLeads);
        }
      }
    } catch (err) {
      console.error('Error in handleViewConfiguration:', err);
      setDetailError('Failed to load configuration details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBackToList = () => {
    setSelectedConfigurationId(null);
    setSelectedConfiguration(null);
    setConfigurationMetrics(null);
    setConfigurationLeads([]);
    setDetailTab('overview');
  };

  const handleArchiveConfiguration = async (id: string) => {
    if (!confirm('Are you sure you want to archive this configuration?')) return;

    try {
      const response = await fetch(`/api/configurations/${id}/archive`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        alert('Configuration archived successfully');
        handleBackToList();
        fetchConfigurations();
      } else {
        alert(data.error || 'Failed to archive configuration');
      }
    } catch (err) {
      alert('Failed to archive configuration');
      console.error(err);
    }
  };

  const handleSaveDraft = async () => {
    setEditorLoading(true);

    try {
      const response = await fetch('/api/configurations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'draft',
          settings: {
            autoDeadLowValueThreshold: autoRejectThreshold,
            autoDeadIrrelevantThreshold: autoRejectThreshold,
            autoForwardDuplicateThreshold: 0.9,
            autoForwardSupportThreshold: 0.9,
            autoSendQualityThreshold: 0.9,
            qualityLeadConfidenceThreshold: qualityThreshold,
          },
          emailTemplate: {},
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Draft saved successfully!');
        setShowEditor(false);
        fetchConfigurations();
      } else {
        alert(data.error || 'Failed to save draft');
      }
    } catch (err) {
      alert('Failed to save draft');
      console.error(err);
    } finally {
      setEditorLoading(false);
    }
  };

  const handleActivateNow = async () => {
    if (!confirm('Activate this configuration now? It will become active for all new leads.')) {
      return;
    }

    setEditorLoading(true);

    try {
      const response = await fetch('/api/configurations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'active',
          settings: {
            autoDeadLowValueThreshold: autoRejectThreshold,
            autoDeadIrrelevantThreshold: autoRejectThreshold,
            autoForwardDuplicateThreshold: 0.9,
            autoForwardSupportThreshold: 0.9,
            autoSendQualityThreshold: 0.9,
            qualityLeadConfidenceThreshold: qualityThreshold,
          },
          emailTemplate: {},
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Configuration activated successfully!');
        setShowEditor(false);
        fetchConfigurations();
      } else {
        alert(data.error || 'Failed to activate');
      }
    } catch (err) {
      alert('Failed to activate');
      console.error(err);
    } finally {
      setEditorLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  // Show detail view if a configuration is selected
  if (selectedConfigurationId) {
    if (detailLoading) {
      return (
        <div>
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      );
    }

    if (detailError || !selectedConfiguration || !configurationMetrics) {
      return (
        <div>
          <button
            onClick={handleBackToList}
            className="mb-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Configurations
          </button>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {detailError || 'Configuration not found'}
          </div>
        </div>
      );
    }

    return (
      <div>
        {/* Back Button */}
        <button
          onClick={handleBackToList}
          className="mb-6 text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
        >
          ← Back to Configurations
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-gray-900">{selectedConfiguration.name}</h2>
                <StatusBadge status={selectedConfiguration.status} />
              </div>
              <p className="text-gray-600">
                Version {selectedConfiguration.version} •{' '}
                {selectedConfiguration.activated_at
                  ? `Activated ${new Date(selectedConfiguration.activated_at as any).toLocaleDateString()}`
                  : 'Draft'}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleClone(selectedConfiguration)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Clone & Edit
              </button>
              {selectedConfiguration.status === 'active' && (
                <button
                  onClick={() => handleArchiveConfiguration(selectedConfiguration.id)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Archive
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-6">
            <TabButton
              active={detailTab === 'overview'}
              onClick={() => setDetailTab('overview')}
            >
              Overview
            </TabButton>
            <TabButton
              active={detailTab === 'config'}
              onClick={() => setDetailTab('config')}
            >
              Configuration
            </TabButton>
            <TabButton
              active={detailTab === 'leads'}
              onClick={() => setDetailTab('leads')}
            >
              Leads ({configurationLeads.length})
            </TabButton>
          </nav>
        </div>

        {/* Tab Content */}
        {detailTab === 'overview' && (
          <div className="space-y-8">
            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <MetricCard title="Total Leads" value={configurationMetrics.total_leads} />
              <MetricCard title="Emails Generated" value={configurationMetrics.emails_generated} />
              <MetricCard title="Emails Sent" value={configurationMetrics.emails_sent} />
              <MetricCard
                title="Approval Rate"
                value={`${configurationMetrics.approval_rate.toFixed(1)}%`}
                highlight
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MetricCard
                title="Edit Rate"
                value={`${configurationMetrics.edit_rate.toFixed(1)}%`}
              />
              <MetricCard
                title="Avg Response Time"
                value={formatResponseTime(configurationMetrics.avg_response_time_ms)}
              />
            </div>

            {/* Classification Breakdown */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Classification Distribution</h3>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <ClassificationBreakdown breakdown={configurationMetrics.classification_breakdown} />
              </div>
            </div>
          </div>
        )}

        {detailTab === 'config' && (
          <div className="space-y-6">
            {/* Settings */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Threshold Settings</h3>
              <div className="space-y-4">
                <ConfigItem
                  label="Auto-Dead Low-Value Threshold"
                  value={selectedConfiguration.settings.autoDeadLowValueThreshold}
                  description="Leads classified as low-value with confidence above this threshold are automatically marked as dead"
                />
                <ConfigItem
                  label="Auto-Dead Irrelevant Threshold"
                  value={selectedConfiguration.settings.autoDeadIrrelevantThreshold}
                  description="Leads classified as irrelevant with confidence above this threshold are automatically marked as dead"
                />
                <ConfigItem
                  label="Auto-Forward Duplicate Threshold"
                  value={selectedConfiguration.settings.autoForwardDuplicateThreshold}
                  description="Duplicate leads with confidence above this threshold are automatically forwarded"
                />
                <ConfigItem
                  label="Auto-Forward Support Threshold"
                  value={selectedConfiguration.settings.autoForwardSupportThreshold}
                  description="Support requests with confidence above this threshold are automatically forwarded"
                />
                <ConfigItem
                  label="Auto-Send Quality Threshold"
                  value={selectedConfiguration.settings.autoSendQualityThreshold}
                  description="Quality leads with confidence above this threshold are automatically sent (future feature)"
                />
                <ConfigItem
                  label="Quality Lead Confidence Threshold"
                  value={selectedConfiguration.settings.qualityLeadConfidenceThreshold}
                  description="Minimum confidence to classify a lead as quality (not for auto-action)"
                />
              </div>
            </div>

            {/* Note about prompts */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">AI Prompts</h3>
              <p className="text-sm text-gray-700">
                AI prompts are managed in code for consistency and version control.
                To modify prompts, update the code in <code className="bg-white px-2 py-1 rounded text-xs">app/lib/prompts.ts</code>
              </p>
            </div>
          </div>
        )}

        {detailTab === 'leads' && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {configurationLeads.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No leads processed under this configuration yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Lead
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Company
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Classification
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {configurationLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{lead.name}</div>
                          <div className="text-xs text-gray-500">{lead.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {lead.company}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {lead.classification && (
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getClassificationColor(lead.classification)}`}>
                              {lead.classification}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(lead.outcome || 'pending')}`}>
                            {lead.outcome || 'pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(lead.created_at as any).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Show editor if active
  if (showEditor) {
    return (
      <div>
        {/* Editor Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">New Configuration</h3>
          <button
            onClick={() => setShowEditor(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕ Cancel
          </button>
        </div>

        {/* Settings */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="space-y-8">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Auto-Reject Confidence Threshold
                </label>
                <p className="text-sm text-gray-600 mb-4">
                  Leads classified as low-value with confidence above this threshold are automatically rejected
                </p>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={autoRejectThreshold}
                    onChange={(e) => setAutoRejectThreshold(parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-2xl font-bold text-gray-900 w-16 text-right">
                    {autoRejectThreshold.toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Quality Lead Confidence Threshold
                </label>
                <p className="text-sm text-gray-600 mb-4">
                  Leads with confidence above this threshold automatically get email drafts generated
                </p>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={qualityThreshold}
                    onChange={(e) => setQualityThreshold(parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-2xl font-bold text-gray-900 w-16 text-right">
                    {qualityThreshold.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={editorLoading}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {editorLoading ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={handleActivateNow}
            disabled={editorLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
          >
            {editorLoading ? 'Activating...' : 'Activate Now'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header Actions */}
      <div className="flex items-center justify-end mb-6">
        <button
          onClick={handleNewConfiguration}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          + New Configuration
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          <FilterTab
            label="All"
            count={configurations.length}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <FilterTab
            label="Active"
            count={configurations.filter(d => d.status === 'active').length}
            active={filter === 'active'}
            onClick={() => setFilter('active')}
          />
          <FilterTab
            label="Draft"
            count={configurations.filter(d => d.status === 'draft').length}
            active={filter === 'draft'}
            onClick={() => setFilter('draft')}
          />
          <FilterTab
            label="Archived"
            count={configurations.filter(d => d.status === 'archived').length}
            active={filter === 'archived'}
            onClick={() => setFilter('archived')}
          />
        </nav>
      </div>

      {/* Configurations List */}
      {configurations.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <div className="text-4xl mb-4">📦</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No configurations found
          </h3>
          <p className="text-gray-600 mb-6">
            {filter === 'all'
              ? 'Create your first configuration to get started'
              : `No ${filter} configurations yet`}
          </p>
          {filter === 'all' && (
            <button
              onClick={handleNewConfiguration}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Create Configuration
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {configurations.map((configuration) => (
            <ConfigurationCard
              key={configuration.id}
              configuration={configuration}
              onActivate={handleActivate}
              onDelete={handleDelete}
              onClone={handleClone}
              onView={handleViewConfiguration}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
        active
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {label} ({count})
    </button>
  );
}

function ConfigurationCard({
  configuration,
  onActivate,
  onDelete,
  onClone,
  onView,
}: {
  configuration: Configuration;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
  onClone: (configuration: Configuration) => void;
  onView: (id: string) => void;
}) {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    active: 'bg-green-100 text-green-800',
    archived: 'bg-yellow-100 text-yellow-800',
  };

  const statusIcons = {
    draft: '📝',
    active: '✅',
    archived: '📁',
  };

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onView(configuration.id)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{statusIcons[configuration.status]}</span>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{configuration.name}</h3>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span>Version {configuration.version}</span>
                <span>•</span>
                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[configuration.status]}`}>
                  {configuration.status.charAt(0).toUpperCase() + configuration.status.slice(1)}
                </span>
                {configuration.activated_at && (
                  <>
                    <span>•</span>
                    <span>
                      Activated {new Date(configuration.activated_at as any).toLocaleDateString()}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-4 flex items-center gap-6 text-sm">
            <div>
              <span className="text-gray-500">Auto-Dead Low-Value:</span>{' '}
              <span className="font-medium text-gray-900">
                {configuration.settings.autoDeadLowValueThreshold}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Quality Threshold:</span>{' '}
              <span className="font-medium text-gray-900">
                {configuration.settings.qualityLeadConfidenceThreshold}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
          {configuration.status === 'draft' && (
            <>
              <button
                onClick={() => onActivate(configuration.id)}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                Activate
              </button>
              <button
                onClick={() => onClone(configuration)}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 transition-colors"
              >
                Clone
              </button>
              <button
                onClick={() => onDelete(configuration.id)}
                className="px-3 py-1.5 border border-red-300 text-red-700 text-sm rounded hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </>
          )}
          {configuration.status === 'active' && (
            <>
              <span className="px-3 py-1.5 bg-green-50 text-green-700 text-sm rounded font-medium">
                Active
              </span>
              <button
                onClick={() => onClone(configuration)}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 transition-colors"
              >
                Clone
              </button>
            </>
          )}
          {configuration.status === 'archived' && (
            <>
              <span className="px-3 py-1.5 bg-gray-50 text-gray-600 text-sm rounded font-medium">
                Archived
              </span>
              <button
                onClick={() => onClone(configuration)}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 transition-colors"
              >
                Clone
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


// Helper components for detail view
function StatusBadge({ status }: { status: string }) {
  const colors = {
    draft: 'bg-gray-100 text-gray-800',
    active: 'bg-green-100 text-green-800',
    archived: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${colors[status as keyof typeof colors]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
        active
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

function MetricCard({
  title,
  value,
  highlight = false,
}: {
  title: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-white border rounded-lg p-6 ${highlight ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}>
      <div className="text-sm text-gray-600 mb-2">{title}</div>
      <div className={`text-3xl font-bold ${highlight ? 'text-blue-700' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  );
}

function ConfigItem({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="pb-4 border-b border-gray-200 last:border-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-900">{label}</span>
        <span className="text-lg font-bold text-gray-900">{value}</span>
      </div>
      <p className="text-xs text-gray-600">{description}</p>
    </div>
  );
}

function ClassificationBreakdown({
  breakdown,
}: {
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

  const items = [
    { key: 'quality', label: 'Quality', color: 'bg-green-500' },
    { key: 'support', label: 'Support', color: 'bg-blue-500' },
    { key: 'low-value', label: 'Low Value', color: 'bg-red-500' },
    { key: 'uncertain', label: 'Uncertain', color: 'bg-yellow-500' },
    { key: 'dead', label: 'Dead', color: 'bg-gray-500' },
    { key: 'duplicate', label: 'Duplicate', color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-4">
      {items.map(({ key, label, color }) => {
        const count = breakdown[key as keyof typeof breakdown];
        const percentage = total > 0 ? (count / total) * 100 : 0;

        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">{label}</span>
              <span className="text-sm text-gray-900">
                {count} ({percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`${color} h-3 rounded-full transition-all`}
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
          </div>
        );
      })}
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

function getClassificationColor(classification: string): string {
  const colors: { [key: string]: string } = {
    quality: 'bg-green-100 text-green-800',
    support: 'bg-blue-100 text-blue-800',
    'low-value': 'bg-red-100 text-red-800',
    uncertain: 'bg-yellow-100 text-yellow-800',
    dead: 'bg-gray-100 text-gray-800',
    duplicate: 'bg-purple-100 text-purple-800',
  };
  return colors[classification] || 'bg-gray-100 text-gray-800';
}

function getStatusColor(status: string): string {
  const colors: { [key: string]: string } = {
    pending: 'bg-blue-100 text-blue-800',
    sent_meeting_offer: 'bg-green-100 text-green-800',
    sent_generic: 'bg-green-100 text-green-800',
    dead: 'bg-red-100 text-red-800',
    forwarded_account_team: 'bg-purple-100 text-purple-800',
    forwarded_support: 'bg-purple-100 text-purple-800',
    error: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

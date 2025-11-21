'use client';

import { useEffect, useState, use } from 'react';
import type { Configuration, Lead } from '@/lib/types';
import { useDeveloperMode } from '@/lib/DeveloperModeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table } from '@/components/ui/table';

export default function ConfigurationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { isDeveloperMode, toggleDeveloperMode } = useDeveloperMode();
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'leads'>('config');
  const [initializingTemplate, setInitializingTemplate] = useState(false);

  useEffect(() => {
    fetchConfigurationDetails();
    fetchLeads();
  }, [id]);

  const fetchConfigurationDetails = async () => {
    try {
      const response = await fetch(`/api/configurations/${id}`);
      const data = await response.json();

      if (data.success) {
        setConfiguration(data.configuration);
      } else {
        setError(data.error || 'Failed to load configuration details');
      }
    } catch (err) {
      setError('Failed to load configuration details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    try {
      const response = await fetch('/api/leads');
      const data = await response.json();

      if (data.success) {
        // Filter leads for this configuration
        const configurationLeads = data.leads.filter(
          (lead: Lead) => lead.configuration_id === id
        );
        setLeads(configurationLeads);
      }
    } catch (err) {
      console.error('Failed to load leads:', err);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Are you sure you want to archive this configuration?')) return;

    try {
      const response = await fetch(`/api/configurations/${id}/archive`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        alert('Configuration archived successfully');
        window.location.href = '/dashboard/configurations';
      } else {
        alert(data.error || 'Failed to archive configuration');
      }
    } catch (err) {
      alert('Failed to archive configuration');
      console.error(err);
    }
  };

  const handleCloneAndEdit = () => {
    // Store configuration data in sessionStorage and redirect to editor
    if (configuration) {
      sessionStorage.setItem('cloneConfiguration', JSON.stringify(configuration));
      window.location.href = '/dashboard/configurations/new';
    }
  };

  const handleInitializeEmailTemplate = async () => {
    if (!configuration) return;

    setInitializingTemplate(true);
    try {
      const response = await fetch(`/api/configurations/${id}/init-email-template`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        setConfiguration(data.configuration);
        alert('Email template initialized successfully');
      } else {
        alert(data.error || 'Failed to initialize email template');
      }
    } catch (err) {
      alert('Failed to initialize email template');
      console.error(err);
    } finally {
      setInitializingTemplate(false);
    }
  };

  const isEmailTemplateConfigured = () => {
    if (!configuration?.emailTemplate) return false;
    const { subject, greeting, signOff, callToAction } = configuration.emailTemplate;
    return !!(subject && greeting && signOff && callToAction);
  };

  const handleDeleteAllConfigurations = async () => {
    if (!confirm('⚠️ WARNING: This will delete ALL configurations from the database. Are you sure?')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/delete-configs', {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        alert(`Successfully deleted ${data.deleted} configuration(s). Redirecting to configurations page...`);
        window.location.href = '/dashboard/configurations';
      } else {
        alert(data.error || 'Failed to delete configurations');
      }
    } catch (err) {
      alert('Failed to delete configurations');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !configuration) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-8">
            <p className="text-destructive">
              {error || 'Configuration not found'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Configuration Info */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{configuration.name}</h1>
            <StatusBadge status={configuration.status} />
          </div>
          <p className="text-muted-foreground">
            {configuration.activated_at
              ? `Activated ${new Date((configuration.activated_at as any).seconds * 1000).toLocaleDateString()}`
              : 'Draft'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={toggleDeveloperMode}
            variant={isDeveloperMode ? 'destructive' : 'outline'}
            size="sm"
          >
            {isDeveloperMode ? '🔧 Dev Mode' : 'Dev Mode'}
          </Button>
          <Button
            onClick={handleCloneAndEdit}
            variant="outline"
            size="sm"
          >
            Clone & Edit
          </Button>
          {configuration.status === 'active' && (
            <Button
              onClick={handleArchive}
              variant="outline"
              size="sm"
            >
              Archive
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="mb-6">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="leads">Leads ({leads.length})</TabsTrigger>
        </TabsList>

        {/* Tab Content */}
        <TabsContent value="config" className="mt-6">
          <div className="space-y-6">
            {/* Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Threshold Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ConfigItem
                  label="Auto-Reject Confidence Threshold"
                  value={configuration.settings.autoRejectConfidenceThreshold}
                  description="Leads classified as low-value with confidence above this threshold are automatically rejected"
                />
                <ConfigItem
                  label="Quality Lead Confidence Threshold"
                  value={configuration.settings.qualityLeadConfidenceThreshold}
                  description="Leads with confidence above this threshold automatically get email drafts generated"
                />
              </CardContent>
            </Card>

            {/* Note about prompts */}
            <Card>
              <CardHeader>
                <CardTitle>AI Prompts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  AI prompts are managed in code for consistency and version control.
                  To modify prompts, update the code in <code className="bg-muted px-2 py-1 rounded text-xs">app/lib/prompts.ts</code>
                </p>
              </CardContent>
            </Card>

            {/* Email Template */}
            <Card>
              <CardHeader>
                <CardTitle>Email Template</CardTitle>
              </CardHeader>
              <CardContent>
                {isEmailTemplateConfigured() ? (
                  <div className="space-y-4">
                    <ConfigItem
                      label="Subject"
                      value={configuration.emailTemplate!.subject!}
                      description="Email subject line"
                    />
                    <ConfigItem
                      label="Greeting"
                      value={configuration.emailTemplate!.greeting!}
                      description="Email greeting (use {firstName} for personalization)"
                    />
                    <ConfigItem
                      label="Sign-Off"
                      value={configuration.emailTemplate!.signOff!}
                      description="Closing phrase before signature (e.g., 'Best,', 'Regards,')"
                    />
                    <ConfigItem
                      label="Call to Action"
                      value={configuration.emailTemplate!.callToAction!}
                      description="Closing call-to-action paragraph"
                    />
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      Email template has not been configured yet.
                    </p>
                    <Button
                      onClick={handleInitializeEmailTemplate}
                      disabled={initializingTemplate}
                    >
                      {initializingTemplate ? 'Initializing...' : 'Initialize Email Template'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Developer Tools */}
            {isDeveloperMode && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-destructive">⚠️ Developer Tools</CardTitle>
                  <CardDescription>
                    Dangerous operations that affect the entire system. Use with caution.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleDeleteAllConfigurations}
                    variant="destructive"
                  >
                    Delete All Configurations
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="leads" className="mt-6">
          <Card>
            {leads.length === 0 ? (
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  No leads processed under this configuration yet.
                </p>
              </CardContent>
            ) : (
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Lead
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Company
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Classification
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {leads.map((lead) => (
                        <tr
                          key={lead.id}
                          className="hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => window.location.href = `/dashboard?leadId=${lead.id}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium">{lead.name}</div>
                            <div className="text-xs text-muted-foreground">{lead.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {lead.company}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {lead.classification && (
                              <Badge variant={getClassificationVariant(lead.classification)}>
                                {lead.classification}
                              </Badge>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={getStatusVariant(lead.status)}>
                              {lead.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {new Date(lead.created_at as any).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <Badge
        variant="secondary"
        className="bg-[#0070f3] text-white hover:bg-[#0070f3] border-0 flex items-center gap-1.5"
      >
        <svg
          height="12"
          width="12"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <circle cx="8" cy="8" r="4" />
        </svg>
        Current
      </Badge>
    );
  }

  const variants = {
    draft: 'secondary' as const,
    archived: 'outline' as const,
  };

  return (
    <Badge variant={variants[status as keyof typeof variants]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function ConfigItem({
  label,
  value,
  description,
}: {
  label: string;
  value: number | string;
  description: string;
}) {
  return (
    <div className="pb-4 border-b border-border last:border-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-lg font-bold">{value}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function getClassificationVariant(classification: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variants: { [key: string]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
    quality: 'default',
    support: 'secondary',
    'low-value': 'destructive',
    uncertain: 'outline',
    dead: 'secondary',
    duplicate: 'outline',
  };
  return variants[classification] || 'outline';
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variants: { [key: string]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
    researching: 'secondary',
    qualifying: 'secondary',
    generating: 'secondary',
    review: 'outline',
    sent: 'default',
    rejected: 'destructive',
    error: 'destructive',
    forwarded: 'outline',
  };
  return variants[status] || 'outline';
}

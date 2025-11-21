'use client';

import { useEffect, useState } from 'react';
import type { Configuration } from '@/lib/types';
import { useDeveloperMode } from '@/lib/DeveloperModeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';

interface ConfigurationsClientProps {
  initialConfigurations: any[];
}

export default function ConfigurationsClient({ initialConfigurations }: ConfigurationsClientProps) {
  const { isDeveloperMode } = useDeveloperMode();
  // Start with server-provided cached data
  const [configurations, setConfigurations] = useState<Configuration[]>(initialConfigurations);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'draft' | 'current' | 'archived'>('all');
  const [isReinitializing, setIsReinitializing] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  useEffect(() => {
    // Only refetch if filter changes from 'all'
    if (filter !== 'all') {
      fetchConfigurations();
    }
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
    if (!confirm('Activate this configuration? It will become current for all new leads.')) {
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

  const handleReinitialize = async () => {
    if (!confirm('Reinitialize configuration with baseline settings? This will update the active deployment.')) {
      return;
    }

    setIsReinitializing(true);
    try {
      const res = await fetch('/api/admin/reinit-config', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ Configuration reinitialized successfully!');
        fetchConfigurations();
      } else {
        alert('❌ Failed to reinitialize: ' + data.error);
      }
    } catch (error) {
      alert('❌ Error reinitializing config: ' + error);
    } finally {
      setIsReinitializing(false);
    }
  };

  const handleDeleteAllConfigurations = async () => {
    if (!confirm('⚠️ Are you sure you want to DELETE ALL CONFIGURATIONS? This cannot be undone!')) {
      return;
    }

    setIsDeletingAll(true);
    try {
      const res = await fetch('/api/dev/delete-all-configurations', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Successfully deleted ${data.deletedCount} configurations`);
        fetchConfigurations();
      } else {
        alert('❌ Failed to delete configurations: ' + data.error);
      }
    } catch (error) {
      alert('❌ Error deleting configurations: ' + error);
    } finally {
      setIsDeletingAll(false);
    }
  };

  if (loading && configurations.length === 0) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const filteredConfigurations = filter === 'all'
    ? configurations
    : configurations.filter(c => c.status === (filter === 'current' ? 'active' : filter));

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header with action button */}
      <div className="flex items-center justify-end mb-8 gap-3">
        {isDeveloperMode && (
          <>
            <Button
              onClick={handleReinitialize}
              disabled={isReinitializing}
              variant="destructive"
              size="sm"
            >
              {isReinitializing ? 'Reinitializing...' : '🔄 Reinitialize Configuration'}
            </Button>
            <Button
              onClick={handleDeleteAllConfigurations}
              disabled={isDeletingAll}
              variant="destructive"
              size="sm"
            >
              {isDeletingAll ? 'Deleting...' : '🗑️ Delete All Configurations'}
            </Button>
          </>
        )}
        <Button
          onClick={() => window.location.href = '/dashboard/configurations/new'}
          size="sm"
        >
          + New Configuration
        </Button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">
            All ({configurations.length})
          </TabsTrigger>
          <TabsTrigger value="current">
            Current ({configurations.filter(d => d.status === 'active').length})
          </TabsTrigger>
          <TabsTrigger value="draft">
            Draft ({configurations.filter(d => d.status === 'draft').length})
          </TabsTrigger>
          <TabsTrigger value="archived">
            Archived ({configurations.filter(d => d.status === 'archived').length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Configurations List */}
      {filteredConfigurations.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-4xl mb-4">📦</div>
            <CardTitle className="mb-2">
              No configurations found
            </CardTitle>
            <CardDescription className="mb-6">
              {filter === 'all'
                ? 'Create your first configuration to get started'
                : `No ${filter === 'current' ? 'current' : filter} configurations yet`}
            </CardDescription>
            {filter === 'all' && (
              <Button
                onClick={() => window.location.href = '/dashboard/configurations/new'}
              >
                Create Configuration
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="bg-[#0a0a0a] border border-[rgba(255,255,255,0.06)] rounded-md">
          <Table>
            <TableBody>
              {filteredConfigurations.map((configuration) => (
                <ConfigurationRow
                  key={configuration.id}
                  configuration={configuration}
                  onActivate={handleActivate}
                  onDelete={handleDelete}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ConfigurationRow({
  configuration,
  onActivate,
  onDelete,
}: {
  configuration: Configuration;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isActive = configuration.status === 'active';
  const isDraft = configuration.status === 'draft';
  const isArchived = configuration.status === 'archived';

  return (
    <TableRow
      className="cursor-pointer hover:bg-[#000000]"
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      onClick={() => window.location.href = `/dashboard/configurations/${configuration.id}`}
    >
      {/* Name & Version */}
      <TableCell className="py-2.5">
        <div className="flex flex-col gap-0.5">
          <div className="font-semibold text-sm">{configuration.name}</div>
          <div className="text-xs text-muted-foreground">Version {configuration.version}</div>
        </div>
      </TableCell>

      {/* Status Badge */}
      <TableCell>
        {isActive && (
          <Badge
            variant="secondary"
            className="bg-[#0070f3] text-white hover:bg-[#0070f3] border-0 flex items-center gap-1.5 w-fit"
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
        )}
        {isDraft && (
          <Badge variant="secondary" className="w-fit">Draft</Badge>
        )}
        {isArchived && (
          <Badge variant="outline" className="w-fit">Archived</Badge>
        )}
      </TableCell>

      {/* Activated Date */}
      <TableCell>
        {configuration.activated_at ? (
          <span className="text-sm text-muted-foreground">
            {new Date(configuration.activated_at as any).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Actions */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 justify-end">
          {isDraft && (
            <>
              <Button
                onClick={() => onActivate(configuration.id)}
                size="sm"
                variant="default"
              >
                Activate
              </Button>
              <Button
                onClick={() => window.location.href = `/dashboard/configurations/${configuration.id}/edit`}
                variant="outline"
                size="sm"
              >
                Edit
              </Button>
              <Button
                onClick={() => onDelete(configuration.id)}
                variant="destructive"
                size="sm"
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

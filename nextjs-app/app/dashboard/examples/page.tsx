'use client';

import { Fragment, useEffect, useState } from 'react';
import { ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ClassificationExample, ExampleStatus } from '@/lib/types';
import { CLASSIFICATIONS } from '@/lib/types';

export default function ExamplesPage() {
  const [examples, setExamples] = useState<ClassificationExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchExamples();
  }, []);

  const fetchExamples = async () => {
    try {
      const response = await fetch('/api/examples');
      const data = await response.json();
      if (data.success) {
        setExamples(data.data);
      }
    } catch (error) {
      console.error('Error fetching examples:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: ExampleStatus) => {
    const newStatus: ExampleStatus = currentStatus === 'active' ? 'inactive' : 'active';

    try {
      const response = await fetch(`/api/examples/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setExamples(prev =>
          prev.map(ex => ex.id === id ? { ...ex, status: newStatus } : ex)
        );
      }
    } catch (error) {
      console.error('Error updating example:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this example?')) return;

    try {
      const response = await fetch(`/api/examples/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setExamples(prev => prev.filter(ex => ex.id !== id));
      }
    } catch (error) {
      console.error('Error deleting example:', error);
    }
  };

  const formatDate = (date: unknown) => {
    // Handle various date formats (string from serialization, Date object, or Timestamp)
    let d: Date;
    if (typeof date === 'string') {
      d = new Date(date);
    } else if (date instanceof Date) {
      d = date;
    } else if (date && typeof date === 'object' && 'toDate' in date) {
      d = (date as { toDate: () => Date }).toDate();
    } else {
      return 'Unknown';
    }
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-1">Classification Examples</h2>
        <p className="text-sm text-muted-foreground">
          Training examples submitted by SDRs to improve AI classification accuracy.
          Active examples are injected into the classification prompt.
        </p>
      </div>

      {examples.length === 0 ? (
        <div className="bg-card border border-border rounded-md p-8 text-center">
          <p className="text-muted-foreground">
            No examples yet. Submit examples from the lead detail page when a lead is marked done.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground w-8"></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Company</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Classification</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Created</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {examples.map((example) => {
                const isExpanded = expandedId === example.id;
                const classificationConfig = CLASSIFICATIONS[example.classification];

                return (
                  <Fragment key={example.id}>
                    <tr
                      className="border-b border-border hover:bg-muted/20 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : example.id)}
                    >
                      <td className="px-4 py-3">
                        <ChevronRight
                          className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {example.lead_snapshot.submission.company}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex px-2.5 py-1 rounded text-xs font-medium"
                          style={{
                            backgroundColor: classificationConfig.colors.background,
                            color: classificationConfig.colors.text,
                            border: `1px solid ${classificationConfig.colors.border}`,
                          }}
                        >
                          {classificationConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStatus(example.id, example.status);
                          }}
                          className={`inline-flex px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                            example.status === 'active'
                              ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/25'
                              : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'
                          }`}
                        >
                          {example.status === 'active' ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(example.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(example.id);
                          }}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-muted/10">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="space-y-4 text-sm">
                            {/* Lead Info */}
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">Lead</div>
                              <div className="text-foreground">
                                {example.lead_snapshot.submission.leadName} ({example.lead_snapshot.submission.email})
                              </div>
                            </div>

                            {/* Message */}
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">Message</div>
                              <div className="text-foreground whitespace-pre-wrap bg-background border border-border rounded p-3">
                                {example.lead_snapshot.submission.message}
                              </div>
                            </div>

                            {/* Research (truncated) */}
                            {example.lead_snapshot.research_report && (
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1">Research (truncated)</div>
                                <div className="text-muted-foreground bg-background border border-border rounded p-3 max-h-32 overflow-y-auto whitespace-pre-wrap">
                                  {example.lead_snapshot.research_report.slice(0, 500)}
                                  {example.lead_snapshot.research_report.length > 500 && '...'}
                                </div>
                              </div>
                            )}

                            {/* SDR Reasoning */}
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">SDR Reasoning</div>
                              <div className="text-foreground bg-background border border-border rounded p-3 whitespace-pre-wrap">
                                {example.sdr_reasoning}
                              </div>
                            </div>

                            {/* Metadata */}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
                              <span>Created by: {example.created_by}</span>
                              <span>Source Lead: {example.source_lead_id}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Stats */}
      <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
        <span>Total: {examples.length}</span>
        <span>Active: {examples.filter(e => e.status === 'active').length}</span>
        <span>Inactive: {examples.filter(e => e.status === 'inactive').length}</span>
      </div>
    </div>
  );
}

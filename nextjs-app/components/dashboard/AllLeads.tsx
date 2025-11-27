'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import { LeadBadge } from '@/components/shared/LeadBadge';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { formatCompactTime, calculateTTR } from '@/lib/date-utils';
import Image from 'next/image';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import type { Lead, Classification } from '@/lib/types';
import { getCurrentClassification, STATUS_FILTER_OPTIONS, TYPE_FILTER_OPTIONS } from '@/lib/types';
import type { DateRange } from 'react-day-picker';
import { CheckCircle2, XCircle, ChevronDown } from 'lucide-react';
import { useDeveloperMode } from '@/lib/DeveloperModeContext';

interface AllLeadsProps {
  initialLeads: Lead[];
}

export default function AllLeads({ initialLeads }: AllLeadsProps) {
  const router = useRouter();
  const { isDeveloperMode } = useDeveloperMode();
  // Start with server-provided cached data (instant render)
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [loading, setLoading] = useState(false);

  // Filter state
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    new Set(STATUS_FILTER_OPTIONS.map(s => s.key))
  );
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(TYPE_FILTER_OPTIONS.map(t => t.key))
  );

  // Demo toggle for visual treatment comparison
  const [demoOption, setDemoOption] = useState<'A' | 'C'>('A');

  // Helper functions for filter multi-select
  const toggleStatus = (key: string) => {
    setSelectedStatuses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const toggleType = (key: string) => {
    setSelectedTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const statusDisplayText = useMemo(() => {
    return `Status ${selectedStatuses.size}/${STATUS_FILTER_OPTIONS.length}`;
  }, [selectedStatuses]);

  const typeDisplayText = useMemo(() => {
    return `Type ${selectedTypes.size}/${TYPE_FILTER_OPTIONS.length}`;
  }, [selectedTypes]);

  // Filter leads based on selected filters
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // Date range filter
      if (dateRange?.from || dateRange?.to) {
        const leadDate = lead.status.received_at instanceof Date
          ? lead.status.received_at
          : new Date((lead.status.received_at as any).toDate?.() || lead.status.received_at);

        if (dateRange.from && leadDate < dateRange.from) return false;
        if (dateRange.to) {
          const endOfDay = new Date(dateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          if (leadDate > endOfDay) return false;
        }
      }

      // Status filter - check lead.status.status
      if (!selectedStatuses.has(lead.status.status)) {
        return false;
      }

      // Type filter - check classification
      const classification = getCurrentClassification(lead) || 'unclassified';
      if (!selectedTypes.has(classification)) {
        return false;
      }

      return true;
    });
  }, [leads, dateRange, selectedStatuses, selectedTypes]);

  useEffect(() => {
    // Set up real-time listener AFTER initial render
    const q = query(
      collection(db, 'leads'),
      orderBy('status.received_at', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setLeads((prevLeads) => {
          const leadMap = new Map(prevLeads.map(lead => [lead.id, lead]));

          snapshot.docChanges().forEach((change) => {
            const leadData = {
              id: change.doc.id,
              ...change.doc.data(),
            } as Lead;

            if (change.type === 'added' || change.type === 'modified') {
              leadMap.set(change.doc.id, leadData);
            } else if (change.type === 'removed') {
              leadMap.delete(change.doc.id);
            }
          });

          // Convert back to array and sort by received_at desc
          return Array.from(leadMap.values()).sort((a, b) => {
            const aTime = a.status.received_at
              ? (a.status.received_at instanceof Date
                ? a.status.received_at.getTime()
                : new Date((a.status.received_at as any).toDate?.() || a.status.received_at).getTime())
              : 0;
            const bTime = b.status.received_at
              ? (b.status.received_at instanceof Date
                ? b.status.received_at.getTime()
                : new Date((b.status.received_at as any).toDate?.() || b.status.received_at).getTime())
              : 0;
            return bTime - aTime;
          });
        });
      },
      (error) => {
        console.error('Error fetching all leads:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading all leads...</p>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-2">No leads yet</p>
        <p className="text-sm text-muted-foreground">
          Submit a lead from the customer page to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Date Range Picker */}
        <DateRangePicker date={dateRange} onDateChange={setDateRange} />

        {/* Status Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {Array.from(selectedStatuses)
                    .map((key) => {
                      const option = STATUS_FILTER_OPTIONS.find(o => o.key === key);
                      return (
                        <div
                          key={key}
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: option?.color }}
                        />
                      );
                    })}
                </div>
                <span className="text-sm font-medium">
                  {statusDisplayText}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[160px]">
            {STATUS_FILTER_OPTIONS.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.key}
                checked={selectedStatuses.has(option.key)}
                onCheckedChange={() => toggleStatus(option.key)}
                onSelect={(e) => e.preventDefault()}
              >
                <div
                  className="h-2 w-2 rounded-full mr-2 shrink-0"
                  style={{ backgroundColor: option.color }}
                />
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Type Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {Array.from(selectedTypes)
                    .slice(0, 3)
                    .map((key) => {
                      const option = TYPE_FILTER_OPTIONS.find(o => o.key === key);
                      return (
                        <div
                          key={key}
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: option?.color }}
                        />
                      );
                    })}
                </div>
                <span className="text-sm font-medium">
                  {typeDisplayText}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[180px]">
            {TYPE_FILTER_OPTIONS.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.key}
                checked={selectedTypes.has(option.key)}
                onCheckedChange={() => toggleType(option.key)}
                onSelect={(e) => e.preventDefault()}
              >
                <div
                  className="h-2 w-2 rounded-full mr-2 shrink-0"
                  style={{ backgroundColor: option.color }}
                />
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Demo Toggle - Visual Treatment Comparison */}
        <div className="ml-auto flex items-center gap-2 px-3 py-2 rounded-md bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
          <span className="text-xs text-muted-foreground">Demo:</span>
          <Button
            variant={demoOption === 'A' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setDemoOption('A')}
          >
            Option A
          </Button>
          <Button
            variant={demoOption === 'C' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setDemoOption('C')}
          >
            Option C
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0a0a0a] border border-[rgba(255,255,255,0.06)] rounded-md">
        <Table>
          <TableBody>
            {filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <p className="text-muted-foreground">No leads match the selected filters</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead) => {
                // Check if this is a test lead and calculate pass/fail
                const isTestLead = lead.metadata?.isTestLead;
                const currentClassification = getCurrentClassification(lead);
                const testPassed = isTestLead && lead.metadata?.expectedClassifications.includes(
                  currentClassification as Classification
                );

                // Check if lead is completed (terminal state)
                const isCompleted = lead.status.status === 'done';

                // Apply visual treatment based on demo option
                const rowClassName = demoOption === 'A'
                  ? `cursor-pointer hover:bg-[#000000] ${isCompleted ? 'opacity-50' : ''}`
                  : `cursor-pointer ${isCompleted ? 'bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.03)]' : 'hover:bg-[#000000]'}`;

                return (
                  <TableRow
                    key={lead.id}
                    className={rowClassName}
                    style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                    onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                  >
                    {/* Test Result Indicator (Dev Mode Only) */}
                    {isDeveloperMode && isTestLead && (
                      <TableCell className="py-2.5 min-w-[200px]">
                        <div className="flex items-center gap-2">
                          {testPassed ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                          )}
                          <div className="flex flex-col gap-0.5 text-xs">
                            <div className="text-muted-foreground">
                              Expected: <span className="text-foreground">{lead.metadata?.expectedClassifications.join(' or ')}</span>
                            </div>
                            <div className="text-muted-foreground">
                              Got: <span className={testPassed ? "text-green-600" : "text-red-600"}>{currentClassification || 'none'}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    )}
                    {isDeveloperMode && !isTestLead && <TableCell className="py-2.5 min-w-[200px]" />}

                    {/* Company & Name - Stacked */}
                    <TableCell className="py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <div className="font-semibold text-sm">{lead.submission.company}</div>
                        <div className="text-xs text-muted-foreground">{lead.submission.leadName}</div>
                      </div>
                    </TableCell>

                    {/* Lead Badge - shows outcome or action */}
                    <TableCell>
                      <LeadBadge lead={lead} />
                    </TableCell>

                    {/* Received - when lead came in */}
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatCompactTime(lead.status.received_at)}
                      </span>
                    </TableCell>

                    {/* Response - TTR + who resolved */}
                    <TableCell>
                      {(() => {
                        const ttr = calculateTTR(lead.status.received_at, lead.status.sent_at);
                        if (!ttr) {
                          return <span className="font-mono text-xs text-muted-foreground">—</span>;
                        }
                        const sentBy = lead.status.sent_by;
                        const isBot = sentBy === 'bot';
                        return (
                          <span className="font-mono text-xs flex items-center gap-1.5">
                            <span style={{ color: '#fafafa' }}>{ttr}</span>
                            <span className="text-muted-foreground">by</span>
                            {isBot ? (
                              <>
                                <span>🤖</span>
                                <span style={{ color: '#fafafa' }}>Bot</span>
                              </>
                            ) : sentBy ? (
                              <>
                                <Image
                                  src="/profpic.jpeg"
                                  alt={sentBy}
                                  width={16}
                                  height={16}
                                  className="rounded-full"
                                />
                                <span style={{ color: '#fafafa' }}>{sentBy}</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </span>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

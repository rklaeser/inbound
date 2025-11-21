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
import { Badge } from '@/components/ui/badge';
import { LeadBadge } from '@/components/shared/LeadBadge';
import { Attribution } from '@/components/shared/Attribution';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { SearchableAuthorFilter } from '@/components/dashboard/SearchableAuthorFilter';
import type { Lead, LeadClassification, LeadOutcome } from '@/lib/types';
import type { DateRange } from 'react-day-picker';
import { ACTIVE_OUTCOMES, getOutcomeColor } from '@/lib/outcomes';
import { CheckCircle2, XCircle } from 'lucide-react';
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
  const [selectedAuthor, setSelectedAuthor] = useState<string>("all");
  const [selectedOutcomes, setSelectedOutcomes] = useState<Set<string>>(new Set());

  // Helper functions for outcome multi-select
  const toggleOutcome = (outcome: string) => {
    setSelectedOutcomes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(outcome)) {
        newSet.delete(outcome);
      } else {
        newSet.add(outcome);
      }
      return newSet;
    });
  };

  const outcomeDisplayText = useMemo(() => {
    if (selectedOutcomes.size === 0) return "All Outcomes";
    return `Outcome ${selectedOutcomes.size}/${ACTIVE_OUTCOMES.length}`;
  }, [selectedOutcomes]);

  // Extract unique authors from leads
  const authors = useMemo(() => {
    const authorSet = new Set<string>();
    leads.forEach(lead => {
      if (lead.reviewed_by) authorSet.add(lead.reviewed_by);
      if (lead.edited_by) authorSet.add(lead.edited_by);
      if (lead.closed_by) authorSet.add(lead.closed_by);
    });
    // Add "Lead Agent" for system-created leads
    authorSet.add("Lead Agent");
    return Array.from(authorSet).sort();
  }, [leads]);

  // Filter leads based on selected filters
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // Date range filter
      if (dateRange?.from || dateRange?.to) {
        const leadDate = new Date(lead.created_at as any);
        if (dateRange.from && leadDate < dateRange.from) return false;
        if (dateRange.to) {
          const endOfDay = new Date(dateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          if (leadDate > endOfDay) return false;
        }
      }

      // Author filter
      if (selectedAuthor !== "all") {
        const leadAuthors = [
          lead.reviewed_by,
          lead.edited_by,
          lead.closed_by,
        ].filter(Boolean);

        // Check if "Lead Agent" is selected and lead has no human authors
        if (selectedAuthor === "Lead Agent") {
          if (leadAuthors.length > 0) return false;
        } else {
          if (!leadAuthors.includes(selectedAuthor)) return false;
        }
      }

      // Outcome filter
      if (selectedOutcomes.size > 0) {
        const outcomeKey = lead.outcome === null ? 'processing' : lead.outcome;
        if (!selectedOutcomes.has(outcomeKey)) {
          return false;
        }
      }

      return true;
    });
  }, [leads, dateRange, selectedAuthor, selectedOutcomes]);

  useEffect(() => {
    // Set up real-time listener AFTER initial render
    // This provides instant initial render + real-time updates
    const q = query(
      collection(db, 'leads'),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Use docChanges() for incremental updates instead of rebuilding entire array
        // This dramatically improves performance for large datasets
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

          // Convert back to array and sort by created_at desc
          return Array.from(leadMap.values()).sort((a, b) => {
            const aTime = a.created_at ? new Date(a.created_at as any).getTime() : 0;
            const bTime = b.created_at ? new Date(b.created_at as any).getTime() : 0;
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

        {/* Author Filter */}
        <SearchableAuthorFilter
          authors={authors}
          selectedAuthor={selectedAuthor}
          onAuthorChange={setSelectedAuthor}
        />

        {/* Outcome Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-[200px] justify-start">
              {outcomeDisplayText}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px]">
            {ACTIVE_OUTCOMES.map((outcome) => (
              <DropdownMenuCheckboxItem
                key={outcome.key || 'processing'}
                checked={selectedOutcomes.has(outcome.key || 'processing')}
                onCheckedChange={() => toggleOutcome(outcome.key || 'processing')}
                onSelect={(e) => e.preventDefault()}
              >
                <div
                  className="h-2 w-2 rounded-full mr-2 shrink-0"
                  style={{ backgroundColor: getOutcomeColor(outcome.key) }}
                />
                {outcome.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Outcome Count Badge */}
        <div className="ml-auto flex items-center gap-2 px-3 py-2 rounded-md bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
          <div className="flex gap-1">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <div className="h-2 w-2 rounded-full bg-yellow-500" />
            <div className="h-2 w-2 rounded-full bg-red-500" />
          </div>
          <span className="text-sm font-medium">
            Showing {filteredLeads.length}/{leads.length}
          </span>
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
                const testPassed = isTestLead && lead.metadata?.expectedClassifications.includes(
                  lead.classification as LeadClassification
                );

                return (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer hover:bg-[#000000]"
                    style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                    onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                  >
                    {/* Test Result Indicator (Dev Mode Only) */}
                    {isDeveloperMode && isTestLead && (
                      <TableCell className="py-2.5 w-12">
                        <div className="flex items-center justify-center">
                          {testPassed ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" title="Test Passed" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" title={`Expected: ${lead.metadata?.expectedClassifications.join(' or ')}, Got: ${lead.classification || 'none'}`} />
                          )}
                        </div>
                      </TableCell>
                    )}
                    {isDeveloperMode && !isTestLead && <TableCell className="py-2.5 w-12" />}

                    {/* Company & Name - Stacked */}
                    <TableCell className="py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <div className="font-semibold text-sm">{lead.company}</div>
                        <div className="text-xs text-muted-foreground">{lead.name}</div>
                      </div>
                    </TableCell>

                    {/* Lead Badge - shows outcome or action */}
                    <TableCell>
                      <LeadBadge lead={lead} />
                    </TableCell>

                    {/* Attribution - shows most recent action */}
                    <TableCell>
                      {lead.closed_at ? (
                        <Attribution date={lead.closed_at} by={lead.closed_by} />
                      ) : lead.reviewed_at ? (
                        <Attribution date={lead.reviewed_at} by={lead.reviewed_by} />
                      ) : (
                        <Attribution date={lead.created_at} by={null} />
                      )}
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

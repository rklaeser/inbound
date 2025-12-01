'use client';

import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, X, Plus, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MatchedCaseStudy } from '@/lib/types';
import type { CaseStudy } from '@/lib/case-studies/types';
import { caseStudyToMatchedCaseStudy } from '@/lib/email/helpers';

interface CaseStudyEditorProps {
  leadId: string;
  caseStudies: MatchedCaseStudy[];
  onUpdate: (caseStudies: MatchedCaseStudy[]) => void;
  disabled?: boolean;
}

export function CaseStudyEditor({
  leadId,
  caseStudies,
  onUpdate,
  disabled = false,
}: CaseStudyEditorProps) {
  const [localCaseStudies, setLocalCaseStudies] = useState<MatchedCaseStudy[]>(caseStudies);
  const [availableCaseStudies, setAvailableCaseStudies] = useState<CaseStudy[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync with props when they change
  useEffect(() => {
    setLocalCaseStudies(caseStudies);
  }, [caseStudies]);

  // Fetch all available case studies for the add modal
  useEffect(() => {
    fetch('/api/case-studies')
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setAvailableCaseStudies(data.data);
        }
      })
      .catch(err => console.error('Failed to fetch case studies:', err));
  }, []);

  const saveChanges = async (newCaseStudies: MatchedCaseStudy[]) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/case-studies`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_studies: newCaseStudies }),
      });

      if (response.ok) {
        onUpdate(newCaseStudies);
      } else {
        console.error('Failed to save case studies');
        // Revert to previous state
        setLocalCaseStudies(caseStudies);
      }
    } catch (err) {
      console.error('Error saving case studies:', err);
      setLocalCaseStudies(caseStudies);
    } finally {
      setIsSaving(false);
    }
  };

  const moveUp = (index: number) => {
    if (index === 0 || disabled) return;
    const newList = [...localCaseStudies];
    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    setLocalCaseStudies(newList);
    saveChanges(newList);
  };

  const moveDown = (index: number) => {
    if (index === localCaseStudies.length - 1 || disabled) return;
    const newList = [...localCaseStudies];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    setLocalCaseStudies(newList);
    saveChanges(newList);
  };

  const remove = (index: number) => {
    if (disabled) return;
    const newList = localCaseStudies.filter((_, i) => i !== index);
    setLocalCaseStudies(newList);
    saveChanges(newList);
  };

  const addCaseStudy = (cs: CaseStudy) => {
    if (disabled) return;
    // Check if already included
    if (localCaseStudies.some(existing => existing.caseStudyId === cs.id)) {
      return;
    }

    // Use shared helper function to transform CaseStudy to MatchedCaseStudy
    const newCaseStudy = caseStudyToMatchedCaseStudy(cs, 'mentioned', 'Manually added by SDR');

    const newList = [...localCaseStudies, newCaseStudy];
    setLocalCaseStudies(newList);
    saveChanges(newList);
    setIsAddModalOpen(false);
  };

  // Filter out already-included case studies from available options
  const availableToAdd = availableCaseStudies.filter(
    cs => !localCaseStudies.some(existing => existing.caseStudyId === cs.id)
  );

  return (
    <div className="space-y-3">
      {localCaseStudies.map((cs, index) => (
        <div
          key={cs.caseStudyId}
          className="border border-[rgba(255,255,255,0.1)] rounded-lg p-4 group"
        >
          <div className="flex items-start gap-3">
            {/* Reorder controls */}
            {!disabled && (
              <div className="flex flex-col items-center gap-0.5 pt-0.5">
                <button
                  onClick={() => moveUp(index)}
                  disabled={index === 0 || isSaving}
                  className="p-0.5 rounded hover:bg-[rgba(255,255,255,0.1)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move up"
                >
                  <ChevronUp className="h-4 w-4 text-[#666]" />
                </button>
                <GripVertical className="h-4 w-4 text-[#444]" />
                <button
                  onClick={() => moveDown(index)}
                  disabled={index === localCaseStudies.length - 1 || isSaving}
                  className="p-0.5 rounded hover:bg-[rgba(255,255,255,0.1)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move down"
                >
                  <ChevronDown className="h-4 w-4 text-[#666]" />
                </button>
              </div>
            )}

            {/* Case study content - Vercel customers page style */}
            <div className="flex-1 min-w-0 flex flex-col">
              {/* Logo */}
              <div className="mb-4 h-8 flex items-center justify-between">
                <div className="h-8 flex items-center">
                  {cs.logoSvg ? (
                    <img
                      src={`data:image/svg+xml;base64,${btoa(cs.logoSvg)}`}
                      alt={`${cs.company} logo`}
                      className="h-8 max-w-[140px] object-contain"
                      style={{ filter: 'brightness(0) invert(1)' }}
                    />
                  ) : (
                    <span className="text-[#888] text-lg font-semibold">{cs.company}</span>
                  )}
                </div>
                {!disabled && (
                  <button
                    onClick={() => remove(index)}
                    disabled={isSaving}
                    className="p-1 rounded hover:bg-[rgba(239,68,68,0.2)] text-[#666] hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Remove case study"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Featured text */}
              {cs.featuredText && (
                <p className="text-[#888] text-base leading-relaxed mb-4">
                  {cs.featuredText}
                </p>
              )}

              {/* Read the full story link */}
              <a
                href={cs.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#888] text-sm hover:text-[#a1a1a1] transition-colors inline-flex items-center gap-1 mt-auto"
              >
                Read the full story
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="ml-1">
                  <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      ))}

      {/* Add button */}
      {!disabled && (
        <Button
          onClick={() => setIsAddModalOpen(true)}
          disabled={isSaving || availableToAdd.length === 0}
          variant="outline"
          size="sm"
          className="w-full border-dashed border-[rgba(255,255,255,0.2)] text-[#666] hover:text-[#a1a1a1] hover:border-[rgba(255,255,255,0.3)]"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Case Study
        </Button>
      )}

      {/* Saving indicator */}
      {isSaving && (
        <div className="text-xs text-[#666] text-center">Saving...</div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsAddModalOpen(false)}
          />
          <div className="relative bg-[#0a0a0a] border border-[rgba(255,255,255,0.1)] rounded-lg p-4 max-w-lg w-full mx-4 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#fafafa] font-semibold">Add Case Study</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded hover:bg-[rgba(255,255,255,0.1)] text-[#666]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {availableToAdd.length === 0 ? (
              <p className="text-[#666] text-sm">All case studies are already included.</p>
            ) : (
              <div className="space-y-3">
                {availableToAdd.map(cs => (
                  <button
                    key={cs.id}
                    onClick={() => addCaseStudy(cs)}
                    className="w-full text-left p-4 rounded-lg border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                  >
                    {/* Logo */}
                    <div className="mb-3 h-6 flex items-center">
                      {cs.logoSvg ? (
                        <img
                          src={`data:image/svg+xml;base64,${btoa(cs.logoSvg)}`}
                          alt={`${cs.company} logo`}
                          className="h-6 max-w-[120px] object-contain"
                          style={{ filter: 'brightness(0) invert(1)' }}
                        />
                      ) : (
                        <span className="text-[#888] font-semibold">{cs.company}</span>
                      )}
                    </div>
                    {/* Featured text */}
                    <p className="text-sm text-[#888] line-clamp-2 leading-relaxed">{cs.featuredText}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

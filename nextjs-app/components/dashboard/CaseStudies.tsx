'use client';

import { useState } from 'react';
import { INDUSTRIES, type CaseStudy, type Industry } from '@/lib/case-studies/types';

interface CaseStudiesProps {
  initialCaseStudies: CaseStudy[];
  initialDefaultCaseStudyId: string | null;
}

export default function CaseStudies({ initialCaseStudies, initialDefaultCaseStudyId }: CaseStudiesProps) {
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>(initialCaseStudies);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | 'all'>('all');

  // Add case study state
  const [newUrl, setNewUrl] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [newFeaturedText, setNewFeaturedText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Default case study state
  const [defaultCaseStudyId, setDefaultCaseStudyId] = useState<string | null>(initialDefaultCaseStudyId);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  // Logo state
  const [editingLogoId, setEditingLogoId] = useState<string | null>(null);
  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [savingLogoId, setSavingLogoId] = useState<string | null>(null);

  // Featured text editing state
  const [editingFeaturedTextId, setEditingFeaturedTextId] = useState<string | null>(null);
  const [featuredTextInput, setFeaturedTextInput] = useState('');
  const [savingFeaturedTextId, setSavingFeaturedTextId] = useState<string | null>(null);

  // Filter case studies by industry and sort with default at top
  const filteredCaseStudies = (selectedIndustry === 'all'
    ? caseStudies
    : caseStudies.filter(cs => cs.industry === selectedIndustry)
  ).toSorted((a, b) => {
    if (a.id === defaultCaseStudyId) return -1;
    if (b.id === defaultCaseStudyId) return 1;
    return 0;
  });

  // Get unique industries from current case studies
  const industriesInUse = new Set(caseStudies.map(cs => cs.industry));
  const availableIndustries = INDUSTRIES.filter(ind => industriesInUse.has(ind));

  async function handleSetDefault(id: string) {
    setSettingDefaultId(id);
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultCaseStudyId: id }),
      });

      const data = await response.json();
      if (data.success) {
        setDefaultCaseStudyId(id);
      } else {
        setError(data.error || 'Failed to set default case study');
      }
    } catch (err) {
      setError('Failed to set default case study');
      console.error(err);
    } finally {
      setSettingDefaultId(null);
    }
  }

  async function fetchCaseStudies() {
    try {
      const response = await fetch('/api/case-studies');
      const data = await response.json();

      if (data.success) {
        setCaseStudies(data.data);
      } else {
        setError(data.error || 'Failed to fetch case studies');
      }
    } catch (err) {
      setError('Failed to fetch case studies');
      console.error(err);
    }
  }

  async function handleAddCaseStudy() {
    // Validate required fields
    if (!newUrl.trim()) {
      setAddError('Case study URL is required');
      return;
    }
    if (!newLogoUrl.trim()) {
      setAddError('Logo SVG URL is required');
      return;
    }
    if (!newFeaturedText.trim()) {
      setAddError('Featured text is required');
      return;
    }

    try {
      new URL(newUrl);
    } catch {
      setAddError('Please enter a valid case study URL');
      return;
    }

    try {
      new URL(newLogoUrl);
    } catch {
      setAddError('Please enter a valid logo URL');
      return;
    }

    setIsAdding(true);
    setAddError(null);

    try {
      // First fetch the logo SVG content
      const svgResponse = await fetch(newLogoUrl);
      if (!svgResponse.ok) {
        throw new Error('Failed to fetch SVG from logo URL');
      }
      const contentType = svgResponse.headers.get('content-type');
      if (!contentType?.includes('svg')) {
        throw new Error('Logo URL does not point to an SVG file');
      }
      const logoSvg = await svgResponse.text();

      // Then extract case study data and create with logo + featured text
      const response = await fetch('/api/case-studies/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newUrl,
          logoSvg,
          featuredText: newFeaturedText,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Refresh the list
        await fetchCaseStudies();
        setNewUrl('');
        setNewLogoUrl('');
        setNewFeaturedText('');
      } else {
        setAddError(data.error || 'Failed to add case study');
      }
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add case study');
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDelete(id: string, company: string) {
    if (!confirm(`Are you sure you want to delete the case study for "${company}"?`)) {
      return;
    }

    setDeletingId(id);

    try {
      const response = await fetch(`/api/case-studies/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setCaseStudies(prev => prev.filter(cs => cs.id !== id));
      } else {
        setError(data.error || 'Failed to delete case study');
      }
    } catch (err) {
      setError('Failed to delete case study');
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSaveLogo(caseStudyId: string, logoUrl: string) {
    setSavingLogoId(caseStudyId);

    try {
      // Logo URL is required
      if (!logoUrl.trim()) {
        throw new Error('Logo URL is required');
      }

      // Fetch the SVG content
      const svgResponse = await fetch(logoUrl);
      if (!svgResponse.ok) {
        throw new Error('Failed to fetch SVG from URL');
      }
      const contentType = svgResponse.headers.get('content-type');
      if (!contentType?.includes('svg')) {
        throw new Error('URL does not point to an SVG file');
      }
      const logoSvg = await svgResponse.text();

      const response = await fetch(`/api/case-studies/${caseStudyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoSvg }),
      });

      const data = await response.json();

      if (data.success) {
        // Update the case study in state with the new logo SVG
        setCaseStudies(prev =>
          prev.map(cs =>
            cs.id === caseStudyId ? { ...cs, logoSvg } : cs
          )
        );
        setEditingLogoId(null);
        setLogoUrlInput('');
      } else {
        setError(data.error || 'Failed to save logo');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save logo');
      console.error(err);
    } finally {
      setSavingLogoId(null);
    }
  }

  async function handleSaveFeaturedText(caseStudyId: string, featuredText: string) {
    if (!featuredText.trim()) {
      setError('Featured text cannot be empty');
      return;
    }

    setSavingFeaturedTextId(caseStudyId);

    try {
      const response = await fetch(`/api/case-studies/${caseStudyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featuredText }),
      });

      const data = await response.json();

      if (data.success) {
        // Update the case study in state with the new featured text
        setCaseStudies(prev =>
          prev.map(cs =>
            cs.id === caseStudyId ? { ...cs, featuredText } : cs
          )
        );
        setEditingFeaturedTextId(null);
        setFeaturedTextInput('');
      } else {
        setError(data.error || 'Failed to save featured text');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save featured text');
      console.error(err);
    } finally {
      setSavingFeaturedTextId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2">
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              style={{ stroke: 'var(--text-secondary)' }}
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              style={{ fill: 'var(--text-primary)' }}
            />
          </svg>
          <span style={{ color: 'var(--text-secondary)' }}>Loading case studies...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="p-4 rounded-md border"
        style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderColor: '#ef4444',
        }}
      >
        <p style={{ color: '#ef4444' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Case Study Section */}
      <div
        className="p-4 rounded-md border"
        style={{
          backgroundColor: 'var(--background-secondary)',
          borderColor: 'var(--border)',
        }}
      >
        <h3
          className="text-sm font-medium mb-3"
          style={{ color: 'var(--text-primary)' }}
        >
          Add Case Study
        </h3>
        <div className="space-y-3">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => {
              setNewUrl(e.target.value);
              setAddError(null);
            }}
            placeholder="Case study URL (e.g., https://vercel.com/customers/notion)"
            className="w-full px-3 py-2 rounded-md border text-sm"
            style={{
              backgroundColor: 'var(--background-primary)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
            disabled={isAdding}
          />
          <input
            type="url"
            value={newLogoUrl}
            onChange={(e) => {
              setNewLogoUrl(e.target.value);
              setAddError(null);
            }}
            placeholder="Logo SVG URL (e.g., https://vercel.com/.../notion-dark.svg)"
            className="w-full px-3 py-2 rounded-md border text-sm"
            style={{
              backgroundColor: 'var(--background-primary)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
            disabled={isAdding}
          />
          <textarea
            value={newFeaturedText}
            onChange={(e) => {
              setNewFeaturedText(e.target.value);
              setAddError(null);
            }}
            placeholder="Featured text (copy from vercel.com/customers)"
            rows={2}
            className="w-full px-3 py-2 rounded-md border text-sm resize-none"
            style={{
              backgroundColor: 'var(--background-primary)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
            disabled={isAdding}
          />
          <button
            onClick={handleAddCaseStudy}
            disabled={isAdding || !newUrl.trim() || !newLogoUrl.trim() || !newFeaturedText.trim()}
            className="w-full px-4 py-2 rounded-md text-sm font-medium transition-opacity disabled:opacity-50"
            style={{
              backgroundColor: 'var(--text-primary)',
              color: 'var(--background-primary)',
            }}
          >
            {isAdding ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Adding...
              </span>
            ) : (
              'Add Case Study'
            )}
          </button>
        </div>
        {addError && (
          <p className="mt-2 text-sm" style={{ color: '#ef4444' }}>
            {addError}
          </p>
        )}
        <p
          className="mt-2 text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          AI will extract company info, description, and products from the case study page
        </p>
      </div>

      {/* Filter Section */}
      <div className="flex items-center gap-4">
        <label
          className="text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          Filter by Industry:
        </label>
        <select
          value={selectedIndustry}
          onChange={(e) => setSelectedIndustry(e.target.value as Industry | 'all')}
          className="px-3 py-1.5 rounded-md border text-sm"
          style={{
            backgroundColor: 'var(--background-secondary)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="all">All Industries ({caseStudies.length})</option>
          {availableIndustries.map((industry) => {
            const count = caseStudies.filter(cs => cs.industry === industry).length;
            return (
              <option key={industry} value={industry}>
                {industry} ({count})
              </option>
            );
          })}
        </select>
        {selectedIndustry !== 'all' && (
          <button
            onClick={() => setSelectedIndustry('all')}
            className="text-xs px-2 py-1 rounded border transition-opacity hover:opacity-70"
            style={{
              color: 'var(--text-secondary)',
              borderColor: 'var(--border)',
            }}
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Results count */}
      {selectedIndustry !== 'all' && (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Showing {filteredCaseStudies.length} case {filteredCaseStudies.length === 1 ? 'study' : 'studies'} in {selectedIndustry}
        </p>
      )}

      {/* Case Studies List */}
      {filteredCaseStudies.length === 0 ? (
        <div className="text-center py-12">
          <p style={{ color: 'var(--text-secondary)' }} className="mb-4">
            {caseStudies.length === 0
              ? 'No case studies found. Add one using the form above or run the migration script.'
              : `No case studies found in "${selectedIndustry}".`
            }
          </p>
          {caseStudies.length === 0 && (
            <code
              className="px-3 py-1 rounded text-sm font-mono"
              style={{
                backgroundColor: 'var(--background-secondary)',
                color: 'var(--text-primary)'
              }}
            >
              npx tsx ../scripts/migrate-case-studies.ts
            </code>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCaseStudies.map((caseStudy) => (
            <div
              key={caseStudy.id}
              className="p-6 rounded-md border"
              style={{
                backgroundColor: 'var(--background-secondary)',
                borderColor: 'var(--border)',
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  {/* Logo */}
                  <div
                    className="w-10 h-10 rounded-md flex items-center justify-center overflow-hidden flex-shrink-0"
                    style={{
                      backgroundColor: 'var(--background-primary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {caseStudy.logoSvg ? (
                      <img
                        src={`data:image/svg+xml;base64,${btoa(caseStudy.logoSvg)}`}
                        alt={`${caseStudy.company} logo`}
                        className="w-8 h-8 object-contain"
                      />
                    ) : (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3
                        className="text-lg font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {caseStudy.company}
                      </h3>
                      {defaultCaseStudyId === caseStudy.id && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: 'rgba(34, 197, 94, 0.15)',
                            color: '#22c55e',
                          }}
                        >
                          Default
                        </span>
                      )}
                    </div>
                    <p
                      className="text-sm mt-1"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {caseStudy.industry}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Logo URL Input */}
                  {editingLogoId === caseStudy.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={logoUrlInput}
                        onChange={(e) => setLogoUrlInput(e.target.value)}
                        placeholder="Logo URL"
                        className="w-48 px-2 py-1 text-sm rounded border"
                        style={{
                          backgroundColor: 'var(--background-primary)',
                          borderColor: 'var(--border)',
                          color: 'var(--text-primary)',
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveLogo(caseStudy.id, logoUrlInput)}
                        disabled={savingLogoId === caseStudy.id}
                        className="text-sm px-2 py-1 rounded border transition-opacity hover:opacity-70 disabled:opacity-50"
                        style={{
                          color: '#22c55e',
                          borderColor: 'var(--border)',
                        }}
                      >
                        {savingLogoId === caseStudy.id ? '...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingLogoId(null);
                          setLogoUrlInput('');
                        }}
                        className="text-sm px-2 py-1 rounded border transition-opacity hover:opacity-70"
                        style={{
                          color: 'var(--text-secondary)',
                          borderColor: 'var(--border)',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingLogoId(caseStudy.id);
                        setLogoUrlInput('');  // Clear since we store SVG content, not URL
                      }}
                      className="text-sm px-3 py-1 rounded border transition-opacity hover:opacity-70"
                      style={{
                        color: 'var(--text-secondary)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      {caseStudy.logoSvg ? 'Edit Logo' : 'Add Logo'}
                    </button>
                  )}
                  {defaultCaseStudyId !== caseStudy.id && (
                    <button
                      onClick={() => handleSetDefault(caseStudy.id)}
                      disabled={settingDefaultId === caseStudy.id}
                      className="text-sm px-3 py-1 rounded border transition-opacity hover:opacity-70 disabled:opacity-50"
                      style={{
                        color: '#22c55e',
                        borderColor: 'var(--border)',
                      }}
                    >
                      {settingDefaultId === caseStudy.id ? 'Setting...' : 'Set Default'}
                    </button>
                  )}
                  <a
                    href={caseStudy.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm px-3 py-1 rounded border transition-opacity hover:opacity-70"
                    style={{
                      color: 'var(--blue)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    View
                  </a>
                  <button
                    onClick={() => handleDelete(caseStudy.id, caseStudy.company)}
                    disabled={deletingId === caseStudy.id}
                    className="text-sm px-3 py-1 rounded border transition-opacity hover:opacity-70 disabled:opacity-50"
                    style={{
                      color: '#ef4444',
                      borderColor: 'var(--border)',
                    }}
                  >
                    {deletingId === caseStudy.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>

              {/* Featured Text (editable) */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p
                    className="text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Featured Text
                  </p>
                  {editingFeaturedTextId !== caseStudy.id && (
                    <button
                      onClick={() => {
                        setEditingFeaturedTextId(caseStudy.id);
                        setFeaturedTextInput(caseStudy.featuredText || '');
                      }}
                      className="text-xs px-2 py-1 rounded border transition-opacity hover:opacity-70"
                      style={{
                        color: 'var(--text-secondary)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      Edit
                    </button>
                  )}
                </div>
                {editingFeaturedTextId === caseStudy.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={featuredTextInput}
                      onChange={(e) => setFeaturedTextInput(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 rounded-md border text-sm resize-none"
                      style={{
                        backgroundColor: 'var(--background-primary)',
                        borderColor: 'var(--border)',
                        color: 'var(--text-primary)',
                      }}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveFeaturedText(caseStudy.id, featuredTextInput)}
                        disabled={savingFeaturedTextId === caseStudy.id}
                        className="text-sm px-3 py-1 rounded border transition-opacity hover:opacity-70 disabled:opacity-50"
                        style={{
                          color: '#22c55e',
                          borderColor: 'var(--border)',
                        }}
                      >
                        {savingFeaturedTextId === caseStudy.id ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingFeaturedTextId(null);
                          setFeaturedTextInput('');
                        }}
                        className="text-sm px-3 py-1 rounded border transition-opacity hover:opacity-70"
                        style={{
                          color: 'var(--text-secondary)',
                          borderColor: 'var(--border)',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p
                    className="text-sm p-3 rounded-md border"
                    style={{
                      backgroundColor: 'var(--background-primary)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                      lineHeight: '1.6',
                    }}
                  >
                    {caseStudy.featuredText || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No featured text set</span>}
                  </p>
                )}
              </div>

              {/* Products */}
              <div>
                <p
                  className="text-xs font-medium uppercase tracking-wider mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Vercel Products
                </p>
                <div className="flex flex-wrap gap-2">
                  {caseStudy.products.map((product, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 rounded text-xs"
                      style={{
                        backgroundColor: 'var(--background-primary)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {product}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

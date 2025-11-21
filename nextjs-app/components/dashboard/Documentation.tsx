'use client';

import { useState, useEffect } from 'react';

type DocType = 'requirements' | 'design' | 'plan' | 'configuration';

interface DocSection {
  title: string;
  content: string | DocSection[];
}

interface Doc {
  title: string;
  description: string;
  sections: DocSection[];
}

interface DocsData {
  requirements: Doc;
  design: Doc;
  plan: Doc;
  configuration: Doc;
}

export default function Documentation() {
  const [activeDoc, setActiveDoc] = useState<DocType>('requirements');
  const [docs, setDocs] = useState<DocsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDocs() {
      try {
        const res = await fetch('/api/docs');
        if (!res.ok) {
          throw new Error('Failed to fetch documentation');
        }
        const data = await res.json();
        setDocs(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load documentation');
      } finally {
        setLoading(false);
      }
    }

    fetchDocs();
  }, []);

  const docTabs = [
    { value: 'requirements' as DocType, label: 'Requirements' },
    { value: 'design' as DocType, label: 'Design' },
    { value: 'plan' as DocType, label: 'Plan' },
    { value: 'configuration' as DocType, label: 'Configuration' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Loading documentation...
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
          borderColor: '#ef4444'
        }}
      >
        <p className="text-sm" style={{ color: '#ef4444' }}>
          Error: {error}
        </p>
      </div>
    );
  }

  const currentDoc = docs?.[activeDoc];

  const renderSection = (section: DocSection, level: number = 0): React.ReactNode => {
    const isArray = Array.isArray(section.content);

    if (isArray) {
      return (
        <div key={section.title} className={level === 0 ? 'mb-6' : 'mb-4'}>
          {section.title && (
            <h3
              className={`font-semibold mb-3 ${level === 0 ? 'text-xl' : 'text-lg'}`}
              style={{ color: 'var(--text-primary)' }}
            >
              {section.title}
            </h3>
          )}
          <div className={level === 0 ? 'space-y-3' : 'space-y-2 pl-4'}>
            {typeof section.content === 'string' ? (
              <div className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {section.content}
              </div>
            ) : (
              section.content.map((subsection, idx) => (
                <div key={idx}>
                  {subsection.title && (
                    <div className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                      {subsection.title}
                    </div>
                  )}
                  <div className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {typeof subsection.content === 'string' ? subsection.content : renderSection(subsection, level + 1)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={section.title} className="mb-6">
        {section.title && (
          <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {section.title}
          </h3>
        )}
        <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {typeof section.content === 'string' ? section.content : null}
        </p>
      </div>
    );
  };

  return (
    <div>
      {/* Document Tabs */}
      <div className="flex gap-2 mb-6 border-b" style={{ borderColor: 'var(--border-custom)' }}>
        {docTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveDoc(tab.value)}
            className="px-4 py-2 text-sm font-medium transition-colors relative"
            style={{
              color: activeDoc === tab.value ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: activeDoc === tab.value ? '2px solid var(--text-primary)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Document Content */}
      <div
        className="rounded-md border p-6 overflow-auto"
        style={{
          backgroundColor: 'var(--background-secondary)',
          borderColor: 'var(--border-custom)',
          maxHeight: 'calc(100vh - 300px)',
        }}
      >
        {currentDoc ? (
          <div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              {currentDoc.title}
            </h1>
            <p className="mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {currentDoc.description}
            </p>
            <div className="space-y-6">
              {currentDoc.sections.map((section, idx) => (
                <div key={idx}>{renderSection(section)}</div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center" style={{ color: 'var(--text-secondary)' }}>
            <p>No content available for this document.</p>
          </div>
        )}
      </div>
    </div>
  );
}

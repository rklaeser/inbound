'use client';

import { useState, useEffect } from 'react';

interface RequirementSection {
  title: string;
  content: string | RequirementSection[];
}

interface RequirementsData {
  title: string;
  description: string;
  sections: RequirementSection[];
}

export default function Requirements() {
  const [requirements, setRequirements] = useState<RequirementsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRequirements() {
      try {
        const res = await fetch('/api/docs');
        if (!res.ok) {
          throw new Error('Failed to fetch requirements');
        }
        const data = await res.json();
        setRequirements(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load requirements');
      } finally {
        setLoading(false);
      }
    }

    fetchRequirements();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">
          Loading requirements...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-md border border-destructive bg-destructive/10">
        <p className="text-sm text-destructive">
          Error: {error}
        </p>
      </div>
    );
  }

  const renderSection = (section: RequirementSection, level: number = 0): React.ReactNode => {
    const isArray = Array.isArray(section.content);

    if (isArray) {
      return (
        <div key={section.title} className={level === 0 ? 'mb-6' : 'mb-4'}>
          {section.title && (
            <h3 className={`font-semibold mb-3 text-foreground ${level === 0 ? 'text-xl' : 'text-lg'}`}>
              {section.title}
            </h3>
          )}
          <div className={level === 0 ? 'space-y-3' : 'space-y-2 pl-4'}>
            {typeof section.content === 'string' ? (
              <div className="leading-relaxed text-muted-foreground">
                {section.content}
              </div>
            ) : (
              section.content.map((subsection, idx) => (
                <div key={idx}>
                  {subsection.title && (
                    <div className="font-medium mb-1 text-foreground">
                      {subsection.title}
                    </div>
                  )}
                  <div className="leading-relaxed text-muted-foreground">
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
          <h3 className="text-xl font-semibold mb-3 text-foreground">
            {section.title}
          </h3>
        )}
        <p className="leading-relaxed text-muted-foreground">
          {typeof section.content === 'string' ? section.content : null}
        </p>
      </div>
    );
  };

  return (
    <div className="rounded-md border border-border bg-card p-6 overflow-auto max-h-[calc(100vh-300px)]">
      {requirements ? (
        <div>
          <h1 className="text-2xl font-bold mb-2 text-foreground">
            {requirements.title}
          </h1>
          <p className="mb-6 leading-relaxed text-muted-foreground">
            {requirements.description}
          </p>
          <div className="space-y-6">
            {requirements.sections.map((section, idx) => (
              <div key={idx}>{renderSection(section)}</div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center text-muted-foreground">
          <p>No requirements available.</p>
        </div>
      )}
    </div>
  );
}

'use client';

import Documentation from '@/components/dashboard/Documentation';

export default function DocsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-1">Documentation</h2>
        <p className="text-sm text-muted-foreground">
          Project documentation and requirements
        </p>
      </div>
      <Documentation />
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useDeveloperMode } from '@/lib/DeveloperModeContext';
import type { Lead } from '@/lib/types';

interface LeadsPageClientProps {
  initialLeads: Lead[];
  children: React.ReactNode;
}

export default function LeadsPageClient({ initialLeads, children }: LeadsPageClientProps) {
  const { isDeveloperMode } = useDeveloperMode();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAllLeads = async () => {
    if (!confirm('⚠️ Are you sure you want to DELETE ALL LEADS? This cannot be undone!')) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch('/api/dev/delete-all-leads', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error deleting leads:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-1">Leads</h2>
          <p className="text-sm text-muted-foreground">
            All inbound sales leads.
          </p>
        </div>
        {isDeveloperMode && (
          <button
            onClick={handleDeleteAllLeads}
            disabled={isDeleting}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
            style={{
              backgroundColor: isDeleting ? '#9ca3af' : '#ef4444',
              color: 'white',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!isDeleting) {
                e.currentTarget.style.backgroundColor = '#dc2626';
              }
            }}
            onMouseLeave={(e) => {
              if (!isDeleting) {
                e.currentTarget.style.backgroundColor = '#ef4444';
              }
            }}
          >
            {isDeleting ? 'Deleting...' : '🗑️ Delete All Leads'}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

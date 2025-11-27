'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { VercelLogo } from '@/components/ui/vercel-logo';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firestore';
import { useDeveloperMode } from '@/lib/DeveloperModeContext';

type TabValue = 'leads' | 'analytics' | 'settings' | 'case-studies';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const { isDeveloperMode, toggleDeveloperMode } = useDeveloperMode();
  const [dynamicName, setDynamicName] = useState<string | null>(null);

  // Fetch dynamic names for detail pages
  useEffect(() => {
    const fetchDynamicName = async () => {
      // Reset dynamic name when pathname changes
      setDynamicName(null);

      // Match /dashboard/leads/[id]
      const leadMatch = pathname.match(/^\/dashboard\/leads\/([^/]+)$/);
      if (leadMatch) {
        const leadId = leadMatch[1];
        try {
          const leadDoc = await getDoc(doc(db, 'leads', leadId));
          if (leadDoc.exists()) {
            setDynamicName(leadDoc.data().company);
          }
        } catch (error) {
          console.error('Error fetching lead:', error);
        }
        return;
      }

    };

    fetchDynamicName();
  }, [pathname]);

  // Build breadcrumb segments
  const getBreadcrumbSegments = () => {
    const segments = pathname.split('/').filter(Boolean);

    // Main dashboard page
    if (segments.length === 1 && segments[0] === 'dashboard') {
      return [{ label: 'Inbound', path: '/dashboard' }];
    }

    // Main section pages - show only Inbound
    const mainPages = ['/dashboard/leads', '/dashboard/analytics', '/dashboard/settings', '/dashboard/case-studies'];
    if (mainPages.includes(pathname)) {
      return [{ label: 'Inbound', path: '/dashboard' }];
    }

    // Detail pages - show Inbound / Item Name
    const leadMatch = pathname.match(/^\/dashboard\/leads\/([^/]+)$/);
    if (leadMatch && dynamicName) {
      return [
        { label: 'Inbound', path: '/dashboard' },
        { label: dynamicName, path: '' }
      ];
    }

    // Default fallback
    return [{ label: 'Inbound', path: '/dashboard' }];
  };

  const breadcrumbSegments = getBreadcrumbSegments();

  // Determine active tab based on pathname
  const getActiveTab = (): TabValue => {
    if (pathname === '/dashboard') return 'leads';
    if (pathname.startsWith('/dashboard/leads')) return 'leads';
    if (pathname.startsWith('/dashboard/analytics')) return 'analytics';
    if (pathname.startsWith('/dashboard/settings')) return 'settings';
    if (pathname.startsWith('/dashboard/case-studies')) return 'case-studies';
    return 'leads';
  };

  const activeTab = getActiveTab();

  const navItems = [
    { value: 'leads' as TabValue, label: 'Leads', path: '/dashboard' },
    { value: 'analytics' as TabValue, label: 'Analytics', path: '/dashboard/analytics' },
    { value: 'settings' as TabValue, label: 'Settings', path: '/dashboard/settings' },
    { value: 'case-studies' as TabValue, label: 'Case Studies', path: '/dashboard/case-studies' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--background-primary)' }}>
      {/* Vercel-style Header */}
      <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}>
        {/* Top Row: Logo/Breadcrumb and Profile */}
        <div className="flex items-center justify-between h-12 px-6">
          {/* Logo and Breadcrumb */}
          <div className="flex items-center gap-2">
            <VercelLogo height={10} />
            {breadcrumbSegments.map((segment, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>/</span>
                {segment.path ? (
                  <button
                    onClick={() => router.push(segment.path)}
                    className="text-xs cursor-pointer hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {segment.label}
                  </button>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
                    {segment.label}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* User Profile */}
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Ryan
              </span>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium cursor-pointer transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'var(--text-primary)',
                }}
              >
                R
              </button>
            </div>

            {/* Dropdown Menu */}
            {showProfileMenu && (
              <>
                {/* Backdrop to close menu */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowProfileMenu(false)}
                />

                {/* Menu */}
                <div
                  className="absolute right-0 mt-2 w-56 rounded-md shadow-lg z-20"
                  style={{
                    backgroundColor: 'var(--background-secondary)',
                    border: '1px solid var(--border-custom)',
                  }}
                >
                  <div className="py-1">
                    <a
                      href="/dashboard"
                      className="block px-4 py-2 text-sm transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      Dashboard
                    </a>
                    <a
                      href="/"
                      className="block px-4 py-2 text-sm transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      Switch to Customer View
                    </a>
                    <a
                      href="/dashboard/docs"
                      className="block px-4 py-2 text-sm transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      Docs
                    </a>

                    {/* Dev Mode Toggle */}
                    <div className="border-t mt-1 pt-1" style={{ borderColor: 'var(--border-custom)' }}>
                      <button
                        onClick={() => {
                          toggleDeveloperMode();
                          setShowProfileMenu(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between"
                        style={{ color: isDeveloperMode ? '#f97316' : 'var(--text-primary)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <span>Dev Mode</span>
                        <span className="text-xs">{isDeveloperMode ? 'ON' : 'OFF'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b" style={{ borderColor: 'var(--border-custom)', backgroundColor: 'rgba(255, 255, 255, 0.03)' }}>
        <div className="px-3">
          <nav className="flex items-end gap-1 h-10">
            {navItems.map((item) => (
              <Link
                key={item.value}
                href={item.path}
                className="px-3 h-full text-xs transition-colors relative inline-flex items-center"
                style={{
                  color: activeTab === item.value ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderBottom: activeTab === item.value ? '3px solid var(--text-primary)' : '3px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== item.value) {
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== item.value) {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      {children}
    </div>
  );
}

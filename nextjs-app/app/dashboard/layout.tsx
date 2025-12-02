'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { VercelLogo } from '@/components/ui/vercel-logo';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/db/client';
import { useDeveloperMode } from '@/lib/DeveloperModeContext';
import { useTheme } from 'next-themes';

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
  const { theme, setTheme } = useTheme();
  const [dynamicName, setDynamicName] = useState<string | null>(null);
  const [caseStudiesEnabled, setCaseStudiesEnabled] = useState(false);

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

  // Fetch settings to check if case studies is enabled
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        const data = await response.json();
        if (data.success) {
          setCaseStudiesEnabled(data.configuration?.experimental?.caseStudies ?? false);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };
    fetchSettings();
  }, []);

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
    ...(caseStudiesEnabled ? [{ value: 'case-studies' as TabValue, label: 'Case Studies', path: '/dashboard/case-studies' }] : []),
    { value: 'settings' as TabValue, label: 'Settings', path: '/dashboard/settings' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Vercel-style Header */}
      <div className="bg-white/[0.03]">
        {/* Top Row: Logo/Breadcrumb and Profile */}
        <div className="flex items-center justify-between h-12 px-6">
          {/* Logo and Breadcrumb */}
          <div className="flex items-center gap-2">
            <VercelLogo height={10} />
            {breadcrumbSegments.map((segment, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">/</span>
                {segment.path ? (
                  <button
                    onClick={() => router.push(segment.path)}
                    className="text-xs cursor-pointer hover:opacity-70 transition-opacity text-foreground"
                  >
                    {segment.label}
                  </button>
                ) : (
                  <span className="text-xs text-foreground">
                    {segment.label}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* User Profile */}
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Ryan
              </span>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium cursor-pointer transition-opacity hover:opacity-80 bg-muted text-foreground"
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
                <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg z-20 bg-card border border-border">
                  <div className="py-1">
                    <a
                      href="/"
                      className="block px-4 py-2 text-sm transition-colors text-foreground hover:bg-white/5"
                    >
                      Contact Sales Form
                    </a>
                    <a
                      href="/dashboard/settings"
                      className="block px-4 py-2 text-sm transition-colors text-foreground hover:bg-white/5"
                    >
                      Requirements
                    </a>

                    {/* Theme Toggle */}
                    <div className="border-t border-border mt-1 pt-1">
                      <button
                        onClick={() => {
                          setTheme(theme === 'dark' ? 'light' : 'dark');
                          setShowProfileMenu(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between hover:bg-white/5 text-foreground"
                      >
                        <span>Theme</span>
                        <span className="text-xs">{theme === 'dark' ? 'Dark' : 'Light'}</span>
                      </button>
                    </div>

                    {/* Dev Mode Toggle */}
                    <div className="border-t border-border pt-1">
                      <button
                        onClick={() => {
                          toggleDeveloperMode();
                          setShowProfileMenu(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between hover:bg-white/5"
                        style={{ color: isDeveloperMode ? '#f97316' : undefined }}
                      >
                        <span className={isDeveloperMode ? 'text-orange-500' : 'text-foreground'}>Dev Mode</span>
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
      <div className="border-b border-border bg-white/[0.03]">
        <div className="px-3">
          <nav className="flex items-end gap-1 h-10">
            {navItems.map((item) => (
              <Link
                key={item.value}
                href={item.path}
                className={`px-3 h-full text-xs transition-colors relative inline-flex items-center ${
                  activeTab === item.value
                    ? 'text-foreground border-b-[3px] border-foreground'
                    : 'text-muted-foreground border-b-[3px] border-transparent hover:text-foreground'
                }`}
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

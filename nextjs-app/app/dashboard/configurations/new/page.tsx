'use client';

import { useEffect, useState } from 'react';
import type { Configuration } from '@/lib/types';

export default function NewConfigurationPage() {
  const [autoRejectThreshold, setAutoRejectThreshold] = useState(0.9);
  const [qualityThreshold, setQualityThreshold] = useState(0.7);
  const [emailSubject, setEmailSubject] = useState('Hi from Vercel');
  const [greeting, setGreeting] = useState('Hi {firstName},');
  const [signOff, setSignOff] = useState('Best,');
  const [callToAction, setCallToAction] = useState("Let's schedule a quick 15-minute call to discuss how Vercel can help.");
  const [activeTab, setActiveTab] = useState<'settings' | 'template'>('settings');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if we're cloning an existing configuration
    const cloneData = sessionStorage.getItem('cloneConfiguration');
    if (cloneData) {
      try {
        const configuration: Configuration = JSON.parse(cloneData);
        setAutoRejectThreshold(configuration.settings.autoDeadLowValueThreshold);
        setQualityThreshold(configuration.settings.qualityLeadConfidenceThreshold);
        setEmailSubject(configuration.emailTemplate?.subject || 'Hi from Vercel');
        setGreeting(configuration.emailTemplate?.greeting || 'Hi {firstName},');
        setSignOff(configuration.emailTemplate?.signOff || 'Best,');
        setCallToAction(configuration.emailTemplate?.callToAction || "Let's schedule a quick 15-minute call to discuss how Vercel can help.");

        // Clear the sessionStorage
        sessionStorage.removeItem('cloneConfiguration');
      } catch (err) {
        console.error('Error loading clone data:', err);
      }
    } else {
      // Load defaults from active configuration
      loadDefaults();
    }
  }, []);

  const loadDefaults = async () => {
    try {
      const response = await fetch('/api/configurations?status=active');
      const data = await response.json();

      if (data.success && data.configurations.length > 0) {
        const activeConfiguration = data.configurations[0];
        setAutoRejectThreshold(activeConfiguration.settings.autoDeadLowValueThreshold);
        setQualityThreshold(activeConfiguration.settings.qualityLeadConfidenceThreshold);
        setEmailSubject(activeConfiguration.emailTemplate?.subject || 'Hi from Vercel');
        setGreeting(activeConfiguration.emailTemplate?.greeting || 'Hi {firstName},');
        setSignOff(activeConfiguration.emailTemplate?.signOff || 'Best,');
        setCallToAction(activeConfiguration.emailTemplate?.callToAction || "Let's schedule a quick 15-minute call to discuss how Vercel can help.");
      }
    } catch (err) {
      console.error('Error loading defaults:', err);
    }
  };

  const handleSaveDraft = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/configurations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'draft',
          settings: {
            autoDeadLowValueThreshold: autoRejectThreshold,
            autoDeadIrrelevantThreshold: autoRejectThreshold,
            autoForwardDuplicateThreshold: 0.9,
            autoForwardSupportThreshold: 0.9,
            autoSendQualityThreshold: 0.9,
            qualityLeadConfidenceThreshold: qualityThreshold,
          },
          emailTemplate: {
            subject: emailSubject,
            greeting: greeting,
            signOff: signOff,
            callToAction: callToAction,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Draft saved successfully!');
        window.location.href = '/dashboard';
      } else {
        setError(data.error || 'Failed to save draft');
      }
    } catch (err) {
      setError('Failed to save draft');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateNow = async () => {
    if (!confirm('Activate this configuration now? It will become active for all new leads.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/configurations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'active',
          settings: {
            autoDeadLowValueThreshold: autoRejectThreshold,
            autoDeadIrrelevantThreshold: autoRejectThreshold,
            autoForwardDuplicateThreshold: 0.9,
            autoForwardSupportThreshold: 0.9,
            autoSendQualityThreshold: 0.9,
            qualityLeadConfidenceThreshold: qualityThreshold,
          },
          emailTemplate: {
            subject: emailSubject,
            greeting: greeting,
            signOff: signOff,
            callToAction: callToAction,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Configuration activated successfully!');
        window.location.href = '/dashboard';
      } else {
        setError(data.error || 'Failed to activate');
      }
    } catch (err) {
      setError('Failed to activate');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          <TabButton
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
          >
            Threshold Settings
          </TabButton>
          <TabButton
            active={activeTab === 'template'}
            onClick={() => setActiveTab('template')}
          >
            Email Template
          </TabButton>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'settings' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="space-y-8">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Auto-Reject Confidence Threshold
              </label>
              <p className="text-sm text-gray-600 mb-4">
                Leads classified as low-value with confidence above this threshold are
                automatically rejected
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={autoRejectThreshold}
                  onChange={(e) => setAutoRejectThreshold(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-2xl font-bold text-gray-900 w-16 text-right">
                  {autoRejectThreshold.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>More lenient (0.0)</span>
                <span>More strict (1.0)</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Quality Lead Confidence Threshold
              </label>
              <p className="text-sm text-gray-600 mb-4">
                Leads with confidence above this threshold automatically get email drafts
                generated
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={qualityThreshold}
                  onChange={(e) => setQualityThreshold(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-2xl font-bold text-gray-900 w-16 text-right">
                  {qualityThreshold.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>More inclusive (0.0)</span>
                <span>More selective (1.0)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'template' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Email Subject Line
              </label>
              <p className="text-sm text-gray-600 mb-4">
                The subject line used for all outbound emails
              </p>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Hi from Vercel"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Email Greeting
              </label>
              <p className="text-sm text-gray-600 mb-4">
                The greeting line for emails. Use {'{firstName}'} for personalization.
              </p>
              <input
                type="text"
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                placeholder="Hi {firstName},"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Call to Action
              </label>
              <p className="text-sm text-gray-600 mb-4">
                The closing call-to-action paragraph for quality lead emails
              </p>
              <textarea
                value={callToAction}
                onChange={(e) => setCallToAction(e.target.value)}
                placeholder="Let's schedule a quick 15-minute call to discuss how Vercel can help."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Sign-Off
              </label>
              <p className="text-sm text-gray-600 mb-4">
                The closing word/phrase before the SDR signature. Common options: &quot;Best,&quot;, &quot;Regards,&quot;, &quot;Thanks,&quot;
              </p>
              <input
                type="text"
                value={signOff}
                onChange={(e) => setSignOff(e.target.value)}
                placeholder="Best,"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-2">
                Note: SDR name and email are managed in <a href="/dashboard/settings" className="text-blue-600 hover:underline">Account Settings</a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => window.location.href = '/dashboard/configurations'}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          disabled={loading}
        >
          Cancel
        </button>
        <div className="flex gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={loading}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={handleActivateNow}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
          >
            {loading ? 'Activating...' : 'Activate Now'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
        active
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

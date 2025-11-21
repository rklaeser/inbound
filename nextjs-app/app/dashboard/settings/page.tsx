'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sdrName, setSdrName] = useState('');
  const [sdrEmail, setSdrEmail] = useState('');
  const [autoRejectThreshold, setAutoRejectThreshold] = useState(0.9);
  const [qualityThreshold, setQualityThreshold] = useState(0.7);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();

      if (data.success && data.settings) {
        setSdrName(data.settings.sdr.name);
        setSdrEmail(data.settings.sdr.email);
        setAutoRejectThreshold(data.settings.autoRejectConfidenceThreshold);
        setQualityThreshold(data.settings.qualityLeadConfidenceThreshold);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sdr: {
            name: sdrName,
            email: sdrEmail
          },
          autoRejectConfidenceThreshold: autoRejectThreshold,
          qualityLeadConfidenceThreshold: qualityThreshold
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Settings saved successfully!');
      } else {
        alert(`Failed to save settings: ${data.error}`);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-400">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-white mb-6">Account Settings</h1>

        {/* SDR Information */}
        <div className="bg-zinc-900 rounded-lg p-6 mb-6 border border-zinc-800">
          <h2 className="text-lg font-semibold text-white mb-4">SDR Information</h2>
          <p className="text-sm text-gray-400 mb-4">
            This information will be used in all email signatures across configurations.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                SDR Name
              </label>
              <input
                type="text"
                value={sdrName}
                onChange={(e) => setSdrName(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ryan"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                SDR Email
              </label>
              <input
                type="email"
                value={sdrEmail}
                onChange={(e) => setSdrEmail(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ryan@vercel.com"
              />
            </div>
          </div>
        </div>

        {/* Classification Thresholds */}
        <div className="bg-zinc-900 rounded-lg p-6 mb-6 border border-zinc-800">
          <h2 className="text-lg font-semibold text-white mb-4">Classification Thresholds</h2>
          <p className="text-sm text-gray-400 mb-4">
            Control how leads are automatically classified based on confidence scores.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Auto-Reject Threshold: {autoRejectThreshold.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={autoRejectThreshold}
                onChange={(e) => setAutoRejectThreshold(parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leads with confidence ≥ {autoRejectThreshold.toFixed(2)} will be auto-rejected
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Quality Lead Threshold: {qualityThreshold.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={qualityThreshold}
                onChange={(e) => setQualityThreshold(parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leads with confidence ≥ {qualityThreshold.toFixed(2)} are considered quality leads
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

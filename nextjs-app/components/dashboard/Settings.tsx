'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Settings {
  autoRejectConfidenceThreshold: number;
  qualityLeadConfidenceThreshold: number;
}

const DEFAULT_SETTINGS: Settings = {
  autoRejectConfidenceThreshold: 0.9,
  qualityLeadConfidenceThreshold: 0.7,
};

export default function Settings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    // Fetch current settings
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.settings) {
          setSettings(data.settings);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching settings:', error);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (data.success) {
        setSaveMessage('Settings saved successfully');
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage('Error saving settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Lead Routing Settings</CardTitle>
          <CardDescription>
            Configure how leads are automatically routed based on AI classification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto-Reject Threshold */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Auto-Reject Confidence Threshold
              </label>
              <p className="text-sm text-muted-foreground mt-1">
                Leads classified as low-value, dead, duplicate, or support with confidence above this threshold will be auto-rejected (no email generation, only visible in All view)
              </p>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={settings.autoRejectConfidenceThreshold * 100}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    autoRejectConfidenceThreshold: Number(e.target.value) / 100,
                  })
                }
                className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, var(--blue) 0%, var(--blue) ${settings.autoRejectConfidenceThreshold * 100}%, rgba(255, 255, 255, 0.1) ${settings.autoRejectConfidenceThreshold * 100}%, rgba(255, 255, 255, 0.1) 100%)`,
                }}
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round(settings.autoRejectConfidenceThreshold * 100)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      autoRejectConfidenceThreshold: Number(e.target.value) / 100,
                    })
                  }
                  className="w-16 px-2 py-1 text-sm text-center rounded border"
                  style={{
                    backgroundColor: 'var(--background-secondary)',
                    borderColor: 'var(--border-custom)',
                    color: 'var(--text-primary)',
                  }}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          {/* Quality Lead Threshold */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Quality Lead Confidence Threshold
              </label>
              <p className="text-sm text-muted-foreground mt-1">
                Leads classified as quality with confidence above this threshold will automatically get an email generated
              </p>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={settings.qualityLeadConfidenceThreshold * 100}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    qualityLeadConfidenceThreshold: Number(e.target.value) / 100,
                  })
                }
                className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, var(--blue) 0%, var(--blue) ${settings.qualityLeadConfidenceThreshold * 100}%, rgba(255, 255, 255, 0.1) ${settings.qualityLeadConfidenceThreshold * 100}%, rgba(255, 255, 255, 0.1) 100%)`,
                }}
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round(settings.qualityLeadConfidenceThreshold * 100)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      qualityLeadConfidenceThreshold: Number(e.target.value) / 100,
                    })
                  }
                  className="w-16 px-2 py-1 text-sm text-center rounded border"
                  style={{
                    backgroundColor: 'var(--background-secondary)',
                    borderColor: 'var(--border-custom)',
                    color: 'var(--text-primary)',
                  }}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: 'var(--border-custom)' }}>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
            {saveMessage && (
              <span
                className="text-sm"
                style={{
                  color: saveMessage.includes('Error') ? '#ef4444' : '#10b981',
                }}
              >
                {saveMessage}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

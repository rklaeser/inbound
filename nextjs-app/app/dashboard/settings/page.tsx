'use client';

import { useEffect, useState } from 'react';
import type { Configuration } from '@/lib/types';
import { DEFAULT_CONFIGURATION } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function SettingsPage() {
  const [config, setConfig] = useState<Configuration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Collapsible sections
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set(['highQuality']));

  // Form state - Thresholds
  const [percentAI, setPercentAI] = useState(0);
  const [autoDeadLowValue, setAutoDeadLowValue] = useState(0.9);
  const [autoDeadIrrelevant, setAutoDeadIrrelevant] = useState(0.85);
  const [autoForwardDuplicate, setAutoForwardDuplicate] = useState(0.9);
  const [autoForwardSupport, setAutoForwardSupport] = useState(0.9);
  const [autoSendQuality, setAutoSendQuality] = useState(0.95);

  // Form state - SDR
  const [sdrName, setSdrName] = useState('');
  const [sdrEmail, setSdrEmail] = useState('');

  // Form state - Forwarding Destinations
  const [supportTeamName, setSupportTeamName] = useState('');
  const [supportTeamEmail, setSupportTeamEmail] = useState('');

  // Form state - Email Templates
  const [emailTemplates, setEmailTemplates] = useState(DEFAULT_CONFIGURATION.emailTemplates);

  // Form state - Email Sending
  const [emailEnabled, setEmailEnabled] = useState(DEFAULT_CONFIGURATION.email.enabled);
  const [emailTestMode, setEmailTestMode] = useState(DEFAULT_CONFIGURATION.email.testMode);
  const [emailTestAddress, setEmailTestAddress] = useState(DEFAULT_CONFIGURATION.email.testEmail);

  const toggleTemplate = (key: string) => {
    setExpandedTemplates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings');
      const data = await response.json();

      if (data.success) {
        setConfig(data.configuration);

        // Populate form - Thresholds
        setPercentAI((data.configuration.rollout?.percentage || 0) * 100);
        setAutoDeadLowValue(data.configuration.thresholds.lowQuality);
        setAutoDeadIrrelevant(data.configuration.thresholds.irrelevant);
        setAutoForwardDuplicate(data.configuration.thresholds.duplicate);
        setAutoForwardSupport(data.configuration.thresholds.support);
        setAutoSendQuality(data.configuration.thresholds.highQuality);

        // Populate form - SDR
        setSdrName(data.configuration.sdr.name);
        setSdrEmail(data.configuration.sdr.email);

        // Populate form - Forwarding Destinations
        setSupportTeamName(data.configuration.supportTeam?.name || DEFAULT_CONFIGURATION.supportTeam.name);
        setSupportTeamEmail(data.configuration.supportTeam?.email || DEFAULT_CONFIGURATION.supportTeam.email);

        // Populate form - Email Templates (with fallback to defaults)
        setEmailTemplates({
          highQuality: data.configuration.emailTemplates?.highQuality || DEFAULT_CONFIGURATION.emailTemplates.highQuality,
          lowQuality: data.configuration.emailTemplates?.lowQuality || DEFAULT_CONFIGURATION.emailTemplates.lowQuality,
          support: data.configuration.emailTemplates?.support || DEFAULT_CONFIGURATION.emailTemplates.support,
          duplicate: data.configuration.emailTemplates?.duplicate || DEFAULT_CONFIGURATION.emailTemplates.duplicate,
          supportInternal: data.configuration.emailTemplates?.supportInternal || DEFAULT_CONFIGURATION.emailTemplates.supportInternal,
          duplicateInternal: data.configuration.emailTemplates?.duplicateInternal || DEFAULT_CONFIGURATION.emailTemplates.duplicateInternal,
        });

        // Populate form - Email Sending (with fallback to defaults)
        setEmailEnabled(data.configuration.email?.enabled ?? DEFAULT_CONFIGURATION.email.enabled);
        setEmailTestMode(data.configuration.email?.testMode ?? DEFAULT_CONFIGURATION.email.testMode);
        setEmailTestAddress(data.configuration.email?.testEmail || DEFAULT_CONFIGURATION.email.testEmail);
      } else {
        setError('Failed to load settings');
      }
    } catch (err) {
      setError('Failed to load settings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thresholds: {
            highQuality: autoSendQuality,
            lowQuality: autoDeadLowValue,
            support: autoForwardSupport,
            duplicate: autoForwardDuplicate,
            irrelevant: autoDeadIrrelevant,
          },
          emailTemplates,
          sdr: {
            name: sdrName,
            email: sdrEmail,
          },
          supportTeam: {
            name: supportTeamName,
            email: supportTeamEmail,
          },
          rollout: {
            enabled: percentAI > 0,
            percentage: percentAI / 100,
          },
          email: {
            enabled: emailEnabled,
            testMode: emailTestMode,
            testEmail: emailTestAddress,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage('Settings saved successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
        loadSettings();
      } else {
        setError(data.error || 'Failed to save settings');
      }
    } catch (err) {
      setError('Failed to save settings');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage('Settings reset to defaults');
        setTimeout(() => setSuccessMessage(null), 3000);
        loadSettings();
      } else {
        setError(data.error || 'Failed to reset settings');
      }
    } catch (err) {
      setError('Failed to reset settings');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const updateTemplate = (
    templateKey: 'highQuality' | 'lowQuality' | 'support' | 'duplicate' | 'supportInternal' | 'duplicateInternal',
    field: string,
    value: string
  ) => {
    setEmailTemplates(prev => ({
      ...prev,
      [templateKey]: {
        ...prev[templateKey],
        [field]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="space-y-6">
          <div className="h-8 bg-[#0a0a0a] rounded-md w-1/3 animate-pulse"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-64 bg-[#0a0a0a] rounded-md animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      {/* Header */}
      <div className="mb-8">
        <h1 style={{ fontSize: '24px', lineHeight: '1.2', fontWeight: 600, color: '#fafafa', marginBottom: '6px' }}>
          System Settings
        </h1>
        <p style={{ fontSize: '13px', color: '#a1a1a1', lineHeight: '1.6' }}>
          Configure AI classification thresholds and email templates
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 border rounded-md p-4" style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)', fontSize: '14px', color: '#ef4444' }}>
          {error}
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 border rounded-md p-4" style={{ backgroundColor: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.2)', fontSize: '14px', color: '#22c55e' }}>
          {successMessage}
        </div>
      )}

      <div className="space-y-6">
        {/* AI Classification Rollout */}
        <Section title="AI Classification Rollout">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block" style={{ fontSize: '12px', fontWeight: 500, color: '#fafafa' }}>
                AI Classification Rate
              </label>
              <span className="font-mono font-semibold" style={{ fontSize: '14px', color: '#fafafa' }}>
                {percentAI}%
              </span>
            </div>
            <p className="mb-2" style={{ fontSize: '11px', color: '#a1a1a1', lineHeight: '1.6' }}>
              Percentage of leads classified by AI. The rest are routed to human classification for validation.
            </p>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={percentAI}
              onChange={(e) => setPercentAI(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, #0070f3 0%, #0070f3 ${percentAI}%, #1a1a1a ${percentAI}%, #1a1a1a 100%)`, transition: 'background 0.15s ease' }}
            />
            <div className="flex justify-between mt-1" style={{ fontSize: '11px', color: '#737373' }}>
              <span>0% (All Human)</span>
              <span>50% (A/B Test)</span>
              <span>100% (Full AI)</span>
            </div>
          </div>
        </Section>

        {/* Email Sending */}
        <Section title="Email Sending">
          <div className="space-y-6">
            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="block" style={{ fontSize: '12px', fontWeight: 500, color: '#fafafa' }}>
                  Enable Email Sending
                </label>
                <p style={{ fontSize: '11px', color: '#a1a1a1', marginTop: '2px' }}>
                  When enabled, emails will actually be sent via Resend
                </p>
              </div>
              <button
                onClick={() => setEmailEnabled(!emailEnabled)}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                style={{ backgroundColor: emailEnabled ? '#0070f3' : '#333' }}
              >
                <span
                  className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                  style={{ transform: emailEnabled ? 'translateX(24px)' : 'translateX(4px)' }}
                />
              </button>
            </div>

            {/* Test Mode Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="block" style={{ fontSize: '12px', fontWeight: 500, color: '#fafafa' }}>
                  Test Mode
                </label>
                <p style={{ fontSize: '11px', color: '#a1a1a1', marginTop: '2px' }}>
                  When enabled, all emails are sent to the test address below
                </p>
              </div>
              <button
                onClick={() => setEmailTestMode(!emailTestMode)}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                style={{ backgroundColor: emailTestMode ? '#0070f3' : '#333' }}
              >
                <span
                  className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                  style={{ transform: emailTestMode ? 'translateX(24px)' : 'translateX(4px)' }}
                />
              </button>
            </div>

            {/* Test Email Address */}
            {emailTestMode && (
              <div>
                <label className="block mb-2" style={{ fontSize: '12px', fontWeight: 500, color: '#a1a1a1' }}>
                  Test Email Address
                </label>
                <input
                  type="email"
                  value={emailTestAddress}
                  onChange={(e) => setEmailTestAddress(e.target.value)}
                  className="w-full border rounded-md p-2"
                  style={{ fontSize: '14px', backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.06)', color: '#fafafa', height: '40px' }}
                  placeholder="test@example.com"
                />
                <p style={{ fontSize: '11px', color: '#737373', marginTop: '4px' }}>
                  All emails will be sent to this address with [TEST] prefix in subject
                </p>
              </div>
            )}

            {/* Status indicator */}
            <div className="border rounded-md p-3" style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: '#000' }}>
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: emailEnabled ? (emailTestMode ? '#f59e0b' : '#22c55e') : '#ef4444' }}
                />
                <span style={{ fontSize: '12px', color: '#a1a1a1' }}>
                  {!emailEnabled
                    ? 'Emails disabled - no emails will be sent'
                    : emailTestMode
                    ? `Test mode - all emails sent to ${emailTestAddress}`
                    : 'Production mode - emails sent to actual recipients'}
                </span>
              </div>
            </div>
          </div>
        </Section>

        {/* Auto-Action Thresholds */}
        <Section title="Auto-Action Thresholds">
          <p className="mb-6" style={{ fontSize: '12px', color: '#a1a1a1', lineHeight: '1.6' }}>
            Confidence thresholds for automatic actions. Leads below these thresholds require human review.
          </p>
          <div className="space-y-6">
            <ThresholdInput label="Auto-Send (High Quality)" value={autoSendQuality} onChange={setAutoSendQuality} description="Automatically send personalized email if confidence >= this threshold" />
            <ThresholdInput label="Auto-Send (Low Quality)" value={autoDeadLowValue} onChange={setAutoDeadLowValue} description="Automatically send generic email if confidence >= this threshold" />
            <ThresholdInput label="Auto-Forward (Support)" value={autoForwardSupport} onChange={setAutoForwardSupport} description="Automatically forward support requests if confidence >= this threshold" />
            <ThresholdInput label="Auto-Forward (Duplicate)" value={autoForwardDuplicate} onChange={setAutoForwardDuplicate} description="Automatically forward duplicate leads to account team if confidence >= this threshold" />
            <ThresholdInput label="Auto-Dead (Irrelevant/Spam)" value={autoDeadIrrelevant} onChange={setAutoDeadIrrelevant} description="Automatically mark irrelevant/spam leads as dead if confidence >= this threshold" />
          </div>
        </Section>

        {/* Email Templates */}
        <Section title="Email Templates">
          <p className="mb-4" style={{ fontSize: '12px', color: '#a1a1a1', lineHeight: '1.6' }}>
            Configure email templates for each classification type. Use {'{firstName}'} for the lead&apos;s first name. Use markdown links: [text](url)
          </p>

          {/* High Quality Template */}
          <EmailTemplateSection
            title="High Quality Email"
            description="Sent from SDR to qualified leads with meeting offer"
            templateKey="highQuality"
            template={emailTemplates.highQuality}
            isExpanded={expandedTemplates.has('highQuality')}
            onToggle={() => toggleTemplate('highQuality')}
            onUpdate={(field, value) => updateTemplate('highQuality', field, value)}
            showSender={false}
          />

          {/* Low Quality Template */}
          <LowQualityTemplateSection
            title="Low Quality Email"
            description="Generic email sent to leads that don't meet qualification criteria (auto-sent)"
            template={emailTemplates.lowQuality as LowQualityTemplateData}
            isExpanded={expandedTemplates.has('lowQuality')}
            onToggle={() => toggleTemplate('lowQuality')}
            onUpdate={(field, value) => updateTemplate('lowQuality', field, value)}
          />

          {/* Support Template */}
          <EmailTemplateSection
            title="Support Email"
            description="Acknowledgment sent to the lead"
            templateKey="support"
            template={emailTemplates.support}
            isExpanded={expandedTemplates.has('support')}
            onToggle={() => toggleTemplate('support')}
            onUpdate={(field, value) => updateTemplate('support', field, value)}
            showSender={true}
          />

          {/* Support Internal Notification */}
          <InternalNotificationSection
            title="Support Internal Notification"
            description="Sent to support team when a support request is received"
            templateKey="supportInternal"
            template={emailTemplates.supportInternal}
            isExpanded={expandedTemplates.has('supportInternal')}
            onToggle={() => toggleTemplate('supportInternal')}
            onUpdate={(field, value) => updateTemplate('supportInternal', field, value)}
          />

          {/* Duplicate Template */}
          <EmailTemplateSection
            title="Duplicate Email"
            description="Acknowledgment sent to the lead"
            templateKey="duplicate"
            template={emailTemplates.duplicate}
            isExpanded={expandedTemplates.has('duplicate')}
            onToggle={() => toggleTemplate('duplicate')}
            onUpdate={(field, value) => updateTemplate('duplicate', field, value)}
            showSender={true}
          />

          {/* Duplicate Internal Notification */}
          <InternalNotificationSection
            title="Duplicate Internal Notification"
            description="Sent to account rep when an existing customer reaches out"
            templateKey="duplicateInternal"
            template={emailTemplates.duplicateInternal}
            isExpanded={expandedTemplates.has('duplicateInternal')}
            onToggle={() => toggleTemplate('duplicateInternal')}
            onUpdate={(field, value) => updateTemplate('duplicateInternal', field, value)}
          />
        </Section>

        {/* SDR Information */}
        <Section title="SDR Information">
          <p className="mb-4" style={{ fontSize: '12px', color: '#a1a1a1', lineHeight: '1.6' }}>
            Used as the sender for high-quality email responses.
          </p>
          <div className="space-y-4">
            <TextInput label="SDR Name" value={sdrName} onChange={setSdrName} />
            <TextInput label="SDR Email" value={sdrEmail} onChange={setSdrEmail} type="email" />
          </div>
        </Section>

        {/* Support Team */}
        <Section title="Support Team">
          <p className="mb-4" style={{ fontSize: '12px', color: '#a1a1a1', lineHeight: '1.6' }}>
            Notified when support requests are received. Duplicate leads are forwarded to the account rep from the CRM.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <TextInput label="Name" value={supportTeamName} onChange={setSupportTeamName} />
            <TextInput label="Email" value={supportTeamEmail} onChange={setSupportTeamEmail} type="email" />
          </div>
        </Section>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <Button onClick={loadSettings} disabled={saving} variant="outline" style={{ transition: 'all 0.15s ease' }}>
            Discard Changes
          </Button>
          <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: '#0070f3', color: '#fff', fontWeight: 500, transition: 'all 0.15s ease' }}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>

        {/* Last Updated */}
        {config && (
          <div className="text-right" style={{ fontSize: '12px', color: '#737373' }}>
            Last updated: {new Date(config.updated_at as any).toLocaleString()} by {config.updated_by}
          </div>
        )}

        {/* Reset to Defaults */}
        <div className="pt-6 mt-6 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 500, color: '#ef4444' }}>Reset to Default Settings</h3>
              <p style={{ fontSize: '11px', color: '#737373', marginTop: '2px' }}>
                Delete current configuration and restore all settings to their default values
              </p>
            </div>
            <Button
              onClick={handleResetToDefaults}
              disabled={saving}
              variant="outline"
              style={{
                color: '#ef4444',
                borderColor: 'rgba(239,68,68,0.2)',
                transition: 'all 0.15s ease'
              }}
            >
              {saving ? 'Resetting...' : 'Reset to Defaults'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-md p-6" style={{ backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.1)', transition: 'border-color 0.15s ease' }}>
      <h2 className="font-sans mb-4" style={{ fontSize: '14px', fontWeight: 600, color: '#fafafa' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function ThresholdInput({ label, value, onChange, description }: { label: string; value: number; onChange: (value: number) => void; description: string }) {
  const percentage = Math.round(value * 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block" style={{ fontSize: '12px', fontWeight: 500, color: '#fafafa' }}>{label}</label>
        <span className="font-mono font-semibold" style={{ fontSize: '14px', color: '#fafafa' }}>{percentage}%</span>
      </div>
      <p className="mb-2" style={{ fontSize: '11px', color: '#a1a1a1', lineHeight: '1.6' }}>{description}</p>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right, #0070f3 0%, #0070f3 ${percentage}%, #1a1a1a ${percentage}%, #1a1a1a 100%)`, transition: 'background 0.15s ease' }}
      />
      <div className="flex justify-between mt-1" style={{ fontSize: '11px', color: '#737373' }}>
        <span>0% (Never)</span>
        <span>50%</span>
        <span>100% (Always)</span>
      </div>
    </div>
  );
}

function TextInput({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <label className="block mb-2" style={{ fontSize: '12px', fontWeight: 500, color: '#a1a1a1' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-md p-2"
        style={{ fontSize: '14px', backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.06)', color: '#fafafa', height: '40px', transition: 'border-color 0.15s ease' }}
        onFocus={(e) => e.target.style.borderColor = '#0070f3'}
        onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}
      />
    </div>
  );
}

interface EmailTemplateData {
  subject: string;
  greeting: string;
  callToAction: string;
  signOff: string;
  senderName?: string;
  senderEmail?: string;
}

function EmailTemplateSection({
  title,
  description,
  templateKey,
  template,
  isExpanded,
  onToggle,
  onUpdate,
  showSender,
}: {
  title: string;
  description: string;
  templateKey: string;
  template: EmailTemplateData;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (field: string, value: string) => void;
  showSender: boolean;
}) {
  return (
    <div className="border rounded-md mb-3" style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: '#000' }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left"
        style={{ transition: 'background 0.15s ease' }}
      >
        <div>
          <h3 style={{ fontSize: '13px', fontWeight: 500, color: '#fafafa' }}>{title}</h3>
          <p style={{ fontSize: '11px', color: '#737373', marginTop: '2px' }}>{description}</p>
        </div>
        {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          <div>
            <label className="block mb-1" style={{ fontSize: '11px', fontWeight: 500, color: '#a1a1a1' }}>Subject</label>
            <input
              type="text"
              value={template.subject}
              onChange={(e) => onUpdate('subject', e.target.value)}
              className="w-full border rounded-md p-2"
              style={{ fontSize: '13px', backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.06)', color: '#fafafa' }}
            />
          </div>

          <div>
            <label className="block mb-1" style={{ fontSize: '11px', fontWeight: 500, color: '#a1a1a1' }}>Greeting</label>
            <input
              type="text"
              value={template.greeting}
              onChange={(e) => onUpdate('greeting', e.target.value)}
              className="w-full border rounded-md p-2"
              style={{ fontSize: '13px', backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.06)', color: '#fafafa' }}
            />
          </div>

          <div>
            <label className="block mb-1" style={{ fontSize: '11px', fontWeight: 500, color: '#a1a1a1' }}>Call to Action</label>
            <textarea
              value={template.callToAction}
              onChange={(e) => onUpdate('callToAction', e.target.value)}
              className="w-full border rounded-md p-2"
              style={{ fontSize: '13px', backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.06)', color: '#fafafa', minHeight: '60px' }}
              rows={2}
            />
          </div>

          <div>
            <label className="block mb-1" style={{ fontSize: '11px', fontWeight: 500, color: '#a1a1a1' }}>Sign Off</label>
            <input
              type="text"
              value={template.signOff}
              onChange={(e) => onUpdate('signOff', e.target.value)}
              className="w-full border rounded-md p-2"
              style={{ fontSize: '13px', backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.06)', color: '#fafafa' }}
            />
          </div>

          {showSender && (
            <>
              <div className="border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <p className="mb-3" style={{ fontSize: '11px', color: '#737373' }}>Sender Information</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1" style={{ fontSize: '11px', fontWeight: 500, color: '#a1a1a1' }}>Sender Name</label>
                    <input
                      type="text"
                      value={template.senderName || ''}
                      onChange={(e) => onUpdate('senderName', e.target.value)}
                      className="w-full border rounded-md p-2"
                      style={{ fontSize: '13px', backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.06)', color: '#fafafa' }}
                    />
                  </div>
                  <div>
                    <label className="block mb-1" style={{ fontSize: '11px', fontWeight: 500, color: '#a1a1a1' }}>Sender Email</label>
                    <input
                      type="email"
                      value={template.senderEmail || ''}
                      onChange={(e) => onUpdate('senderEmail', e.target.value)}
                      className="w-full border rounded-md p-2"
                      style={{ fontSize: '13px', backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.06)', color: '#fafafa' }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface LowQualityTemplateData {
  subject: string;
  body: string;
  senderName: string;
  senderEmail: string;
}

function LowQualityTemplateSection({
  title,
  description,
  template,
  isExpanded,
  onToggle,
  onUpdate,
}: {
  title: string;
  description: string;
  template: LowQualityTemplateData;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (field: string, value: string) => void;
}) {
  return (
    <div className="border rounded-md mb-3" style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: '#000' }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left"
        style={{ transition: 'background 0.15s ease' }}
      >
        <div>
          <h3 style={{ fontSize: '13px', fontWeight: 500, color: '#fafafa' }}>{title}</h3>
          <p style={{ fontSize: '11px', color: '#737373', marginTop: '2px' }}>{description}</p>
        </div>
        {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          <div>
            <label className="block mb-1" style={{ fontSize: '11px', fontWeight: 500, color: '#a1a1a1' }}>Subject</label>
            <input
              type="text"
              value={template.subject}
              onChange={(e) => onUpdate('subject', e.target.value)}
              className="w-full border rounded-md p-2"
              style={{ fontSize: '13px', backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.06)', color: '#fafafa' }}
            />
          </div>

          <div>
            <label className="block mb-1" style={{ fontSize: '11px', fontWeight: 500, color: '#a1a1a1' }}>Body</label>
            <textarea
              value={template.body}
              onChange={(e) => onUpdate('body', e.target.value)}
              className="w-full border rounded-md p-2"
              style={{ fontSize: '13px', backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.06)', color: '#fafafa', minHeight: '160px', fontFamily: 'monospace' }}
              rows={8}
            />
            <p className="mt-1" style={{ fontSize: '10px', color: '#525252' }}>
              This is the complete email body sent to low-quality leads. Use markdown for links: [text](url)
            </p>
          </div>

          <div className="border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p className="mb-3" style={{ fontSize: '11px', color: '#737373' }}>Sender Information</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1" style={{ fontSize: '11px', fontWeight: 500, color: '#a1a1a1' }}>Sender Name</label>
                <input
                  type="text"
                  value={template.senderName || ''}
                  onChange={(e) => onUpdate('senderName', e.target.value)}
                  className="w-full border rounded-md p-2"
                  style={{ fontSize: '13px', backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.06)', color: '#fafafa' }}
                />
              </div>
              <div>
                <label className="block mb-1" style={{ fontSize: '11px', fontWeight: 500, color: '#a1a1a1' }}>Sender Email</label>
                <input
                  type="email"
                  value={template.senderEmail || ''}
                  onChange={(e) => onUpdate('senderEmail', e.target.value)}
                  className="w-full border rounded-md p-2"
                  style={{ fontSize: '13px', backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.06)', color: '#fafafa' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface InternalNotificationData {
  subject: string;
  body: string;
}

function InternalNotificationSection({
  title,
  description,
  templateKey,
  template,
  isExpanded,
  onToggle,
  onUpdate,
}: {
  title: string;
  description: string;
  templateKey: string;
  template: InternalNotificationData;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (field: string, value: string) => void;
}) {
  return (
    <div className="border rounded-md mb-3" style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: '#000' }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left"
        style={{ transition: 'background 0.15s ease' }}
      >
        <div>
          <h3 style={{ fontSize: '13px', fontWeight: 500, color: '#fafafa' }}>{title}</h3>
          <p style={{ fontSize: '11px', color: '#737373', marginTop: '2px' }}>{description}</p>
        </div>
        {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          <div>
            <label className="block mb-1" style={{ fontSize: '11px', fontWeight: 500, color: '#a1a1a1' }}>Subject</label>
            <input
              type="text"
              value={template.subject}
              onChange={(e) => onUpdate('subject', e.target.value)}
              className="w-full border rounded-md p-2"
              style={{ fontSize: '13px', backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.06)', color: '#fafafa' }}
            />
            <p className="mt-1" style={{ fontSize: '10px', color: '#525252' }}>
              Variables: {'{firstName}'}, {'{company}'}, {'{email}'}
            </p>
          </div>

          <div>
            <label className="block mb-1" style={{ fontSize: '11px', fontWeight: 500, color: '#a1a1a1' }}>Body</label>
            <textarea
              value={template.body}
              onChange={(e) => onUpdate('body', e.target.value)}
              className="w-full border rounded-md p-2"
              style={{ fontSize: '13px', backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.06)', color: '#fafafa', minHeight: '120px', fontFamily: 'monospace' }}
              rows={6}
            />
            <p className="mt-1" style={{ fontSize: '10px', color: '#525252' }}>
              Variables: {'{firstName}'}, {'{company}'}, {'{email}'}, {'{message}'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

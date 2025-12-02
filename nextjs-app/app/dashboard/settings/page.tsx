'use client';

import { useEffect, useState } from 'react';
import type { Configuration } from '@/lib/types';
import { DEFAULT_CONFIGURATION } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function SettingsPage() {
  const [config, setConfig] = useState<Configuration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);


  // Form state - Thresholds
  const [percentAI, setPercentAI] = useState(0);
  const [autoDeadLowValue, setAutoDeadLowValue] = useState(0.85);
  const [autoForwardSupport, setAutoForwardSupport] = useState(0.9);
  const [autoSendQuality, setAutoSendQuality] = useState(0.98);
  const [allowHighQualityAutoSend, setAllowHighQualityAutoSend] = useState(false);

  // Form state - SDR
  const [sdrName, setSdrName] = useState('');
  const [sdrLastName, setSdrLastName] = useState('');
  const [sdrEmail, setSdrEmail] = useState('');
  const [sdrTitle, setSdrTitle] = useState('');

  // Form state - Forwarding Destinations
  const [supportTeamEmail, setSupportTeamEmail] = useState('');

  // Form state - Email Templates
  const [emailTemplates, setEmailTemplates] = useState(DEFAULT_CONFIGURATION.emailTemplates);

  // Form state - Email Sending
  const [emailEnabled, setEmailEnabled] = useState(DEFAULT_CONFIGURATION.email.enabled);
  const [emailTestMode, setEmailTestMode] = useState(DEFAULT_CONFIGURATION.email.testMode);
  const [emailTestAddress, setEmailTestAddress] = useState(DEFAULT_CONFIGURATION.email.testEmail);

  // Form state - Prompts
  const [classificationPrompt, setClassificationPrompt] = useState(DEFAULT_CONFIGURATION.prompts.classification);
  const [emailHighQualityPrompt, setEmailHighQualityPrompt] = useState(DEFAULT_CONFIGURATION.prompts.emailHighQuality);
  const [classificationEvalPrompt, setClassificationEvalPrompt] = useState(DEFAULT_CONFIGURATION.prompts.classificationEval);
  const [emailHighQualityEvalPrompt, setEmailHighQualityEvalPrompt] = useState(DEFAULT_CONFIGURATION.prompts.emailHighQualityEval);

  // Form state - Experimental Features
  const [experimentalCaseStudies, setExperimentalCaseStudies] = useState(DEFAULT_CONFIGURATION.experimental.caseStudies);

  // Form state - Response to Lead toggles
  const [responseToLeadLowQuality, setResponseToLeadLowQuality] = useState(false);
  const [responseToLeadSupport, setResponseToLeadSupport] = useState(false);
  const [responseToLeadDuplicate, setResponseToLeadDuplicate] = useState(false);

  // Active section for sidebar navigation
  const [activeSection, setActiveSection] = useState<'classification' | 'emails' | 'hardcoded'>('classification');


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
        setAutoForwardSupport(data.configuration.thresholds.support);
        setAutoSendQuality(data.configuration.thresholds.highQuality);
        setAllowHighQualityAutoSend(data.configuration.allowHighQualityAutoSend ?? false);

        // Populate form - SDR
        setSdrName(data.configuration.sdr.name);
        setSdrLastName(data.configuration.sdr.lastName || '');
        setSdrEmail(data.configuration.sdr.email);
        setSdrTitle(data.configuration.sdr.title || '');

        // Populate form - Forwarding Destinations
        setSupportTeamEmail(data.configuration.supportTeam?.email || DEFAULT_CONFIGURATION.supportTeam.email);

        // Populate form - Email Templates (with fallback to defaults)
        setEmailTemplates({
          highQuality: data.configuration.emailTemplates?.highQuality || DEFAULT_CONFIGURATION.emailTemplates.highQuality,
          lowQuality: data.configuration.emailTemplates?.lowQuality || DEFAULT_CONFIGURATION.emailTemplates.lowQuality,
          support: data.configuration.emailTemplates?.support || DEFAULT_CONFIGURATION.emailTemplates.support,
          existing: data.configuration.emailTemplates?.existing || DEFAULT_CONFIGURATION.emailTemplates.existing,
          supportInternal: data.configuration.emailTemplates?.supportInternal || DEFAULT_CONFIGURATION.emailTemplates.supportInternal,
          existingInternal: data.configuration.emailTemplates?.existingInternal || DEFAULT_CONFIGURATION.emailTemplates.existingInternal,
        });

        // Populate form - Email Sending (with fallback to defaults)
        setEmailEnabled(data.configuration.email?.enabled ?? DEFAULT_CONFIGURATION.email.enabled);
        setEmailTestMode(data.configuration.email?.testMode ?? DEFAULT_CONFIGURATION.email.testMode);
        setEmailTestAddress(data.configuration.email?.testEmail || DEFAULT_CONFIGURATION.email.testEmail);

        // Populate form - Prompts (with fallback to defaults)
        setClassificationPrompt(data.configuration.prompts?.classification || DEFAULT_CONFIGURATION.prompts.classification);
        setEmailHighQualityPrompt(data.configuration.prompts?.emailHighQuality || DEFAULT_CONFIGURATION.prompts.emailHighQuality);
        setClassificationEvalPrompt(data.configuration.prompts?.classificationEval || DEFAULT_CONFIGURATION.prompts.classificationEval);
        setEmailHighQualityEvalPrompt(data.configuration.prompts?.emailHighQualityEval || DEFAULT_CONFIGURATION.prompts.emailHighQualityEval);

        // Populate form - Experimental Features (with fallback to defaults)
        setExperimentalCaseStudies(data.configuration.experimental?.caseStudies ?? DEFAULT_CONFIGURATION.experimental.caseStudies);

        // Populate form - Response to Lead toggles (with fallback to defaults)
        setResponseToLeadLowQuality(data.configuration.responseToLead?.lowQuality ?? false);
        setResponseToLeadSupport(data.configuration.responseToLead?.support ?? false);
        setResponseToLeadDuplicate(data.configuration.responseToLead?.existing ?? false);
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
          },
          allowHighQualityAutoSend,
          emailTemplates,
          sdr: {
            name: sdrName,
            lastName: sdrLastName,
            email: sdrEmail,
            title: sdrTitle,
          },
          supportTeam: {
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
          prompts: {
            classification: classificationPrompt,
            emailHighQuality: emailHighQualityPrompt,
            classificationEval: classificationEvalPrompt,
            emailHighQualityEval: emailHighQualityEvalPrompt,
          },
          experimental: {
            caseStudies: experimentalCaseStudies,
          },
          responseToLead: {
            lowQuality: responseToLeadLowQuality,
            support: responseToLeadSupport,
            existing: responseToLeadDuplicate,
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
    templateKey: 'highQuality' | 'lowQuality' | 'support' | 'existing' | 'supportInternal' | 'existingInternal',
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

  // Auto-save handler for individual template fields
  const saveTemplateField = async (
    templateKey: 'highQuality' | 'lowQuality' | 'support' | 'existing' | 'supportInternal' | 'existingInternal',
    field: string,
    value: string
  ) => {
    // Update local state
    const newTemplates = {
      ...emailTemplates,
      [templateKey]: {
        ...emailTemplates[templateKey],
        [field]: value,
      },
    };
    setEmailTemplates(newTemplates);

    // Save to API
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailTemplates: newTemplates }),
    });
  };

  // Auto-save handler for prompt fields
  const savePromptField = async (field: 'classification' | 'emailHighQuality' | 'classificationEval' | 'emailHighQualityEval', value: string) => {
    // Update local state
    if (field === 'classification') {
      setClassificationPrompt(value);
    } else if (field === 'emailHighQuality') {
      setEmailHighQualityPrompt(value);
    } else if (field === 'classificationEval') {
      setClassificationEvalPrompt(value);
    } else if (field === 'emailHighQualityEval') {
      setEmailHighQualityEvalPrompt(value);
    }

    // Save to API
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompts: { [field]: value } }),
    });
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="space-y-6">
          <div className="h-8 bg-card rounded-md w-1/3 animate-pulse"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-64 bg-card rounded-md animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const sections = [
    { id: 'classification' as const, label: 'Classification' },
    { id: 'emails' as const, label: 'Emails' },
    { id: 'hardcoded' as const, label: 'Hardcoded' },
  ];

  return (
    <div className="font-sans">
      {/* Header */}
      <div className="border-b border-border">
        <div className="px-8 py-6">
          <h1 className="text-2xl leading-tight font-semibold text-foreground">
            Settings
          </h1>
        </div>
      </div>

      {/* Messages */}
      {(error || successMessage) && (
        <div className="px-8 pt-6">
          {error && (
            <div className="mb-4 border border-destructive/20 rounded-md p-4 text-sm bg-destructive/10 text-destructive">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="mb-4 border border-green-500/20 rounded-md p-4 text-sm bg-green-500/10 text-green-500">
              {successMessage}
            </div>
          )}
        </div>
      )}

      {/* Main layout with sidebar */}
      <div className="flex px-8 py-8 gap-8">
        {/* Sidebar */}
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${
                  activeSection === section.id
                    ? 'text-foreground bg-muted font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content area */}
        <div className="flex-1 max-w-2xl">
          {/* CLASSIFICATION SECTION */}
          {activeSection === 'classification' && (
            <div className="space-y-0">
              <SettingsCard
                title="Rollout"
                description="Percentage of leads classified by AI. The rest are routed to human classification."
                footer={
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>0% (All Human)</span>
                    <span>50% (A/B Test)</span>
                    <span>100% (Full Bot)</span>
                  </div>
                }
                action={
                  <span className="font-mono font-semibold text-sm text-foreground">
                    {percentAI}%
                  </span>
                }
              >
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={percentAI}
                  onChange={(e) => setPercentAI(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer transition-[background] duration-150"
                  style={{ background: `linear-gradient(to right, hsl(var(--info)) 0%, hsl(var(--info)) ${percentAI}%, hsl(var(--secondary)) ${percentAI}%, hsl(var(--secondary)) 100%)` }}
                />
              </SettingsCard>

              <SettingsCard
                title="Classification Prompt"
                description="The prompt used by Bot to classify incoming leads into categories (high-quality, low-quality, support, existing)."
              >
                <div>
                  <MarkdownEditor
                    initialContent={classificationPrompt}
                    onSave={(value) => savePromptField('classification', value)}
                    minHeight="300px"
                  />
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    This prompt instructs the Bot on how to analyze and classify leads. Be specific about classification criteria and edge cases.
                  </p>
                </div>
              </SettingsCard>

              <SettingsCard
                title="Classification Evaluation Prompt"
                description="Used by a separate model (GPT-4o) to judge whether classifications are correct. Evaluates quality based on human judgment criteria."
              >
                <div>
                  <MarkdownEditor
                    initialContent={classificationEvalPrompt}
                    onSave={(value) => savePromptField('classificationEval', value)}
                    minHeight="300px"
                  />
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    This prompt evaluates Bot classifications against human judgment. Focus on criteria like: Would an SDR agree? Is there real revenue potential?
                  </p>
                </div>
              </SettingsCard>
            </div>
          )}

          {/* EMAILS SECTION */}
          {activeSection === 'emails' && (
            <div className="space-y-0">
              <SettingsCard
                title="Experimental Features"
                description="Preview features that may change or be removed."
              >
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-medium text-foreground">
                      Case Studies
                    </label>
                    <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[400px]">
                      When enabled, matched case studies are appended to high-quality emails and shown on the lead detail page
                    </p>
                  </div>
                  <button
                    onClick={() => setExperimentalCaseStudies(!experimentalCaseStudies)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${experimentalCaseStudies ? 'bg-info' : 'bg-secondary'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${experimentalCaseStudies ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </div>
              </SettingsCard>

              <EmailTemplateCard
                title="High Quality"
                description="Sent from SDR to qualified leads with meeting offer"
                template={emailTemplates.highQuality}
                onUpdate={(field, value) => updateTemplate('highQuality', field, value)}
                onSaveField={(field, value) => saveTemplateField('highQuality', field, value)}
                isFirst={true}
                bodyPrompt={emailHighQualityPrompt}
                onBodyPromptSave={(value) => savePromptField('emailHighQuality', value)}
                evalPrompt={emailHighQualityEvalPrompt}
                onEvalPromptSave={(value) => savePromptField('emailHighQualityEval', value)}
              />

              <EmailTemplateCard
                title="Low Quality"
                description="Generic email sent to leads that don't meet qualification criteria"
                template={emailTemplates.lowQuality as LowQualityTemplateData}
                onUpdate={(field, value) => updateTemplate('lowQuality', field, value)}
                onSaveField={(field, value) => saveTemplateField('lowQuality', field, value)}
                templateType="lowQuality"
                thresholdValue={autoDeadLowValue}
                onThresholdChange={setAutoDeadLowValue}
                thresholdDescription="Automatically send this email when classification confidence >= threshold"
                responseToLead={responseToLeadLowQuality}
                onResponseToLeadChange={setResponseToLeadLowQuality}
              />

              <EmailTemplateCard
                title="Support"
                description="Acknowledgment sent to the lead"
                template={emailTemplates.support}
                onUpdate={(field, value) => updateTemplate('support', field, value)}
                onSaveField={(field, value) => saveTemplateField('support', field, value)}
                templateType="simple"
                thresholdValue={autoForwardSupport}
                onThresholdChange={setAutoForwardSupport}
                thresholdDescription="Automatically forward to support team when classification confidence >= threshold"
                responseToLead={responseToLeadSupport}
                onResponseToLeadChange={setResponseToLeadSupport}
              />

              <EmailTemplateCard
                title="Support Internal"
                description="Sent to support team when a support request is received"
                template={emailTemplates.supportInternal}
                onUpdate={(field, value) => updateTemplate('supportInternal', field, value)}
                onSaveField={(field, value) => saveTemplateField('supportInternal', field, value)}
                templateType="internal"
                recipientEmail={supportTeamEmail}
                onRecipientEmailChange={setSupportTeamEmail}
              />

              <EmailTemplateCard
                title="Existing"
                description="Acknowledgment sent to the lead"
                template={emailTemplates.existing}
                onUpdate={(field, value) => updateTemplate('existing', field, value)}
                onSaveField={(field, value) => saveTemplateField('existing', field, value)}
                responseToLead={responseToLeadDuplicate}
                onResponseToLeadChange={setResponseToLeadDuplicate}
                templateType="simple"
              />

              <EmailTemplateCard
                title="Existing Internal"
                description="Sent to account rep when an existing customer reaches out"
                template={emailTemplates.existingInternal}
                onUpdate={(field, value) => updateTemplate('existingInternal', field, value)}
                onSaveField={(field, value) => saveTemplateField('existingInternal', field, value)}
                templateType="internal"
                isLast={true}
              />
            </div>
          )}

          {/* HARDCODED SECTION */}
          {activeSection === 'hardcoded' && (
            <div className="space-y-0">
              <SettingsCard
                title="SDR Information"
                description="Used as the sender for high-quality email responses."
              >
                <div className="space-y-4">
                  <TextInput label="SDR First Name" value={sdrName} onChange={setSdrName} />
                  <TextInput label="SDR Last Name" value={sdrLastName} onChange={setSdrLastName} />
                  <TextInput label="SDR Email" value={sdrEmail} onChange={setSdrEmail} type="email" />
                  <div>
                    <TextInput label="SDR Title" value={sdrTitle} onChange={setSdrTitle} />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Signature preview: Best, {sdrName || 'Ryan'} / {sdrName || 'Ryan'} {sdrLastName || 'Hemelt'} / ▲ Vercel {sdrTitle || 'Development Representative'}
                    </p>
                  </div>
                </div>
              </SettingsCard>

              <SettingsCard
                title="Email Sending"
                description="Control whether emails are actually sent and configure test mode."
              >
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-medium text-foreground">
                        Enable Email Sending
                      </label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        When enabled, emails will actually be sent via Resend
                      </p>
                    </div>
                    <button
                      onClick={() => setEmailEnabled(!emailEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${emailEnabled ? 'bg-info' : 'bg-secondary'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${emailEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-medium text-foreground">
                        Test Mode
                      </label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        When enabled, all emails are sent to the test address below
                      </p>
                    </div>
                    <button
                      onClick={() => setEmailTestMode(!emailTestMode)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${emailTestMode ? 'bg-info' : 'bg-secondary'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${emailTestMode ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>

                  {emailTestMode && (
                    <div>
                      <label className="block mb-2 text-xs font-medium text-muted-foreground">
                        Test Email Address
                      </label>
                      <input
                        type="email"
                        value={emailTestAddress}
                        onChange={(e) => setEmailTestAddress(e.target.value)}
                        className="w-full border border-border/60 rounded-md p-2 text-sm bg-card text-foreground h-10 focus:border-info focus:outline-none transition-colors"
                        placeholder="test@example.com"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        All emails will be sent to this address with [TEST] prefix in subject
                      </p>
                    </div>
                  )}

                  <div className="border border-border/60 rounded-md p-3 bg-background">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${emailEnabled ? (emailTestMode ? 'bg-amber-500' : 'bg-green-500') : 'bg-destructive'}`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {!emailEnabled
                          ? 'Emails disabled - no emails will be sent'
                          : emailTestMode
                          ? `Test mode - all emails sent to ${emailTestAddress}`
                          : 'Production mode - emails sent to actual recipients'}
                      </span>
                    </div>
                  </div>
                </div>
              </SettingsCard>

              {/* Reset to Defaults - only in Hardcoded section */}
              <SettingsCard
                title="Reset to Default Settings"
                description="Delete current configuration and restore all settings to their default values."
              >
                <Button
                  onClick={handleResetToDefaults}
                  disabled={saving}
                  variant="destructive"
                  className="transition-all duration-150"
                >
                  {saving ? 'Resetting...' : 'Reset to Defaults'}
                </Button>
              </SettingsCard>
            </div>
          )}

          {/* Save buttons - always visible */}
          <div className="mt-8 flex justify-between items-center">
            <div>
              {config && (
                <span className="text-xs text-muted-foreground">
                  Last updated: {new Date(config.updated_at as any).toLocaleString()} by {config.updated_by}
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <Button onClick={loadSettings} disabled={saving} variant="outline" className="transition-all duration-150">
                Discard Changes
              </Button>
              <Button onClick={handleSave} disabled={saving} variant="info" className="font-medium transition-all duration-150">
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsCard({
  title,
  description,
  children,
  footer,
  action,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-x border-t border-border first:rounded-t-lg last:rounded-b-lg last:border-b bg-card">
      <div className="p-6">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-sm font-medium text-foreground">
            {title}
          </h3>
          {action}
        </div>
        <p className={`text-[13px] text-muted-foreground leading-normal ${children ? 'mb-4' : ''}`}>
          {description}
        </p>
        {children}
      </div>
      {footer && (
        <div className="px-6 py-3 border-t border-border/60 bg-background">
          {footer}
        </div>
      )}
    </div>
  );
}

// Unified email template card that works as a top-level settings card
function EmailTemplateCard({
  title,
  description,
  template,
  onUpdate,
  onSaveField,
  templateType = 'highQuality',
  recipientEmail,
  onRecipientEmailChange,
  isFirst = false,
  isLast = false,
  bodyPrompt,
  onBodyPromptChange,
  onBodyPromptSave,
  evalPrompt,
  onEvalPromptSave,
  thresholdValue,
  onThresholdChange,
  thresholdDescription,
  responseToLead,
  onResponseToLeadChange,
}: {
  title: string;
  description: string;
  template: any;
  onUpdate: (field: string, value: string) => void;
  onSaveField: (field: string, value: string) => Promise<void>;
  templateType?: 'highQuality' | 'lowQuality' | 'simple' | 'internal';
  recipientEmail?: string;
  onRecipientEmailChange?: (value: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
  bodyPrompt?: string;
  onBodyPromptChange?: (value: string) => void;
  onBodyPromptSave?: (value: string) => Promise<void>;
  evalPrompt?: string;
  onEvalPromptSave?: (value: string) => Promise<void>;
  thresholdValue?: number;
  onThresholdChange?: (value: number) => void;
  thresholdDescription?: string;
  responseToLead?: boolean;
  onResponseToLeadChange?: (value: boolean) => void;
}) {
  // Determine if template content should be disabled (grayed out)
  const isDisabled = responseToLead !== undefined && !responseToLead;

  return (
    <div
      className={`border-x border-t border-border bg-card ${isFirst ? 'rounded-t-lg' : ''} ${isLast ? 'rounded-b-lg border-b' : ''}`}
    >
      <div className="p-6">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-foreground">{title}</h3>
              <p className="text-[13px] text-muted-foreground mt-1">{description}</p>
            </div>
            {/* Response to Lead toggle - only show if handler is provided */}
            {onResponseToLeadChange && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Response to Lead</span>
                <button
                  onClick={() => onResponseToLeadChange(!responseToLead)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${responseToLead ? 'bg-info' : 'bg-secondary'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${responseToLead ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className={`space-y-4 transition-opacity ${isDisabled ? 'opacity-40 pointer-events-none' : ''}`}>
          {/* Auto-send threshold for templates that support it */}
          {thresholdValue !== undefined && onThresholdChange && (
            <div className="pb-4 border-b border-border/60">
              <ThresholdInput
                label="Auto-Send Threshold"
                value={thresholdValue}
                onChange={onThresholdChange}
                description={thresholdDescription || "Automatically send this email when confidence >= threshold"}
                disabled={isDisabled}
              />
            </div>
          )}

          {/* Recipient email for internal notifications */}
          {templateType === 'internal' && recipientEmail !== undefined && onRecipientEmailChange && (
            <div>
              <label className="block mb-1 text-[11px] font-medium text-muted-foreground">Recipient Email</label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => onRecipientEmailChange(e.target.value)}
                className="w-full border border-border/60 rounded-md p-2 text-[13px] bg-card text-foreground focus:border-info focus:outline-none transition-colors"
                placeholder="support@example.com"
              />
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                Email address where this notification will be sent
              </p>
            </div>
          )}

          {/* Subject - all types have this */}
          <div>
            <label className="block mb-1 text-[11px] font-medium text-muted-foreground">Subject</label>
            <input
              type="text"
              value={template.subject}
              onChange={(e) => onUpdate('subject', e.target.value)}
              className="w-full border border-border/60 rounded-md p-2 text-[13px] bg-card text-foreground focus:border-info focus:outline-none transition-colors"
            />
          </div>

          {/* High Quality template fields */}
          {templateType === 'highQuality' && (
            <>
              <div>
                <label className="block mb-1 text-[11px] font-medium text-muted-foreground">Greeting</label>
                <RichTextEditor
                  initialContent={template.greeting}
                  onSave={(value) => onSaveField('greeting', value)}
                />
                <p className="mt-1 text-[10px] text-muted-foreground/70">
                  Use {'{firstName}'} to personalize
                </p>
              </div>
              {bodyPrompt !== undefined && onBodyPromptSave && (
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-muted-foreground">Body Prompt</label>
                  <MarkdownEditor
                    initialContent={bodyPrompt}
                    onSave={onBodyPromptSave}
                    minHeight="200px"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground/70">
                    This prompt instructs the Bot on how to generate the email body for high-quality leads. The greeting, call-to-action, and sign-off are added automatically.
                  </p>
                </div>
              )}
              {evalPrompt !== undefined && onEvalPromptSave && (
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-muted-foreground">Evaluation Prompt</label>
                  <MarkdownEditor
                    initialContent={evalPrompt}
                    onSave={onEvalPromptSave}
                    minHeight="200px"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground/70">
                    Used by a separate model (GPT-4o) to judge email quality. Evaluates personalization, tone, relevance, and call-to-action.
                  </p>
                </div>
              )}
              <div>
                <label className="block mb-1 text-[11px] font-medium text-muted-foreground">Call to Action</label>
                <RichTextEditor
                  initialContent={template.callToAction}
                  onSave={(value) => onSaveField('callToAction', value)}
                />
                <p className="mt-1 text-[10px] text-muted-foreground/70">
                  Use {'{leadId}'} in links for the meeting booking URL
                </p>
              </div>
              <div>
                <label className="block mb-1 text-[11px] font-medium text-muted-foreground">Sign Off</label>
                <RichTextEditor
                  initialContent={template.signOff}
                  onSave={(value) => onSaveField('signOff', value)}
                />
              </div>
            </>
          )}

          {/* Low Quality template fields */}
          {templateType === 'lowQuality' && (
            <>
              <div>
                <label className="block mb-1 text-[11px] font-medium text-muted-foreground">Body</label>
                <RichTextEditor
                  initialContent={template.body}
                  onSave={(value) => onSaveField('body', value)}
                />
                <p className="mt-1 text-[10px] text-muted-foreground/70">
                  Complete email body including sign-off
                </p>
              </div>
              <div className="border-t border-border/60 pt-4">
                <p className="mb-3 text-[11px] text-muted-foreground">Sender Information</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-[11px] font-medium text-muted-foreground">Sender Name</label>
                    <input
                      type="text"
                      value={template.senderName || ''}
                      onChange={(e) => onUpdate('senderName', e.target.value)}
                      className="w-full border border-border/60 rounded-md p-2 text-[13px] bg-card text-foreground focus:border-info focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-[11px] font-medium text-muted-foreground">Sender Email</label>
                    <input
                      type="email"
                      value={template.senderEmail || ''}
                      onChange={(e) => onUpdate('senderEmail', e.target.value)}
                      className="w-full border border-border/60 rounded-md p-2 text-[13px] bg-card text-foreground focus:border-info focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Simple template fields (Support, Duplicate emails) */}
          {templateType === 'simple' && (
            <>
              <div>
                <label className="block mb-1 text-[11px] font-medium text-muted-foreground">Greeting</label>
                <input
                  type="text"
                  value={template.greeting}
                  onChange={(e) => onUpdate('greeting', e.target.value)}
                  className="w-full border border-border/60 rounded-md p-2 text-[13px] bg-card text-foreground focus:border-info focus:outline-none transition-colors"
                />
                <p className="mt-1 text-[10px] text-muted-foreground/70">
                  Use {'{firstName}'} to personalize
                </p>
              </div>
              <div>
                <label className="block mb-1 text-[11px] font-medium text-muted-foreground">Body</label>
                <RichTextEditor
                  initialContent={template.body}
                  onSave={(value) => onSaveField('body', value)}
                />
                <p className="mt-1 text-[10px] text-muted-foreground/70">
                  Include sign-off in the body. Use {'{firstName}'} to personalize.
                </p>
              </div>
            </>
          )}

          {/* Internal notification template fields */}
          {templateType === 'internal' && (
            <div>
              <label className="block mb-1 text-[11px] font-medium text-muted-foreground">Body</label>
              <RichTextEditor
                initialContent={template.body}
                onSave={(value) => onSaveField('body', value)}
              />
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                Variables: {'{firstName}'}, {'{company}'}, {'{email}'}, {'{message}'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ThresholdInput({ label, value, onChange, description, disabled = false }: { label: string; value: number; onChange: (value: number) => void; description: string; disabled?: boolean }) {
  const percentage = Math.round(value * 100);

  return (
    <div className={`transition-opacity duration-150 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs font-medium text-foreground">{label}</label>
        <span className="font-mono font-semibold text-sm text-foreground">{percentage}%</span>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground leading-relaxed">{description}</p>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="w-full h-2 rounded-lg appearance-none transition-[background] duration-150"
        style={{
          background: `linear-gradient(to right, hsl(var(--info)) 0%, hsl(var(--info)) ${percentage}%, hsl(var(--secondary)) ${percentage}%, hsl(var(--secondary)) 100%)`,
          cursor: disabled ? 'not-allowed' : 'pointer'
        }}
      />
      <div className="flex justify-between mt-1 text-[11px] text-muted-foreground">
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
      <label className="block mb-2 text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-border/60 rounded-md p-2 text-sm bg-card text-foreground h-10 transition-colors focus:border-info focus:outline-none"
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

interface SimpleEmailTemplateData {
  subject: string;
  greeting: string;
  body: string;
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

function SimpleEmailTemplateSection({
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
  template: SimpleEmailTemplateData;
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
            <label className="block mb-1" style={{ fontSize: '11px', fontWeight: 500, color: '#a1a1a1' }}>Greeting</label>
            <input
              type="text"
              value={template.greeting}
              onChange={(e) => onUpdate('greeting', e.target.value)}
              className="w-full border rounded-md p-2"
              style={{ fontSize: '13px', backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.06)', color: '#fafafa' }}
            />
            <p className="mt-1" style={{ fontSize: '10px', color: '#525252' }}>
              Use {'{firstName}'} to personalize
            </p>
          </div>

          <div>
            <label className="block mb-1" style={{ fontSize: '11px', fontWeight: 500, color: '#a1a1a1' }}>Body</label>
            <textarea
              value={template.body}
              onChange={(e) => onUpdate('body', e.target.value)}
              className="w-full border rounded-md p-2"
              style={{ fontSize: '13px', backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.06)', color: '#fafafa', minHeight: '120px' }}
              rows={5}
            />
            <p className="mt-1" style={{ fontSize: '10px', color: '#525252' }}>
              Include sign-off in the body (e.g., "Best,\nThe Vercel Team")
            </p>
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
  recipientEmail,
  onRecipientEmailChange,
}: {
  title: string;
  description: string;
  templateKey: string;
  template: InternalNotificationData;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (field: string, value: string) => void;
  recipientEmail?: string;
  onRecipientEmailChange?: (value: string) => void;
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
          {recipientEmail !== undefined && onRecipientEmailChange && (
            <div>
              <label className="block mb-1" style={{ fontSize: '11px', fontWeight: 500, color: '#a1a1a1' }}>Recipient Email</label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => onRecipientEmailChange(e.target.value)}
                className="w-full border rounded-md p-2"
                style={{ fontSize: '13px', backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.06)', color: '#fafafa' }}
                placeholder="support@example.com"
              />
              <p className="mt-1" style={{ fontSize: '10px', color: '#525252' }}>
                Email address where this notification will be sent
              </p>
            </div>
          )}

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

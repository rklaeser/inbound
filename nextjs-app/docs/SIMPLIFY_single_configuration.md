# Single Configuration Simplification Plan

## Overview

Replace the multi-configuration system (draft/active/archived with versioning) with a **single, directly editable configuration**. Use `percentAIClassification` as the intuitive lever for gradual AI rollout.

## Relationship to Human Classification Workflow

This simplification **should be implemented alongside** `PLAN_human_classification_workflow.md`, not after.

### Why Implement Together?

The human classification workflow plan introduces `humanClassificationRate` for sampling, which eliminates the need for multiple configurations. Rather than:

1. ❌ Build multi-configuration system
2. ❌ Implement human classification with `humanClassificationRate`
3. ❌ Realize we don't need multiple configurations
4. ❌ Refactor to single configuration

We should:

1. ✅ Simplify to single configuration **as part of** implementing human classification
2. ✅ Use `percentAIClassification` instead of `humanClassificationRate`
3. ✅ Never build the complexity we don't need

### Key Changes from Original Plan

**From `PLAN_human_classification_workflow.md`:**
```typescript
// OLD: humanClassificationRate (0-100% of leads go to human)
humanClassificationRate: number;
```

**This Plan:**
```typescript
// NEW: percentAIClassification (0-100% of leads handled by AI)
percentAIClassification: number;
```

**Logic Adjustment:**
```typescript
// OLD (from original plan):
const shouldSampleForHuman = Math.random() * 100 < config.settings.humanClassificationRate;

// NEW (this plan - more intuitive):
const useAI = Math.random() * 100 < config.settings.percentAIClassification;
if (!useAI) {
  // Route to human classification
}
```

### What Stays the Same

Everything else from `PLAN_human_classification_workflow.md` remains valid:
- ✅ `needs_classification` outcome
- ✅ AI classification stored in `ai_*` fields for comparison
- ✅ `sampled_for_human` flag
- ✅ Post-classification auto-actions
- ✅ Human vs AI comparison analytics
- ✅ Low-value email templates
- ✅ Classify UI with A/B testing logic (show/hide AI prediction)

---

## The Problem: Over-Engineered Configuration System

### Current State

**Multiple Configuration System:**
- Versioning (v1, v2, v3...)
- Status management (draft, active, archived)
- Multiple configurations exist, only one "active" at a time
- Leads tagged with `configuration_id` for A/B testing
- Analytics compare performance across configurations
- Complex UI: create drafts, activate, archive, clone, compare

**Why It Exists:**
Originally designed for A/B testing different threshold settings to find optimal configuration.

**Why It's Unnecessary:**
With `percentAIClassification`, we can test changes incrementally:
- Set to 0% → All leads go to human (validate new thresholds against human judgment)
- Set to 50% → Half to AI, half to human (A/B comparison)
- Set to 90% → Gradual rollout (ongoing quality monitoring)
- Set to 100% → Full AI automation

No need for separate "configurations" to compare - just adjust the percentage!

### Problems with Current Approach

1. **Complexity**: Managing drafts, activation, archival, versioning
2. **Confusion**: Two separate settings systems:
   - `lib/account-settings.ts` (SystemSettings)
   - `lib/types.ts` (Configuration with versioning)
3. **Cognitive Overhead**: Users must understand configuration lifecycle
4. **Unnecessary State**: Draft configs that may never be activated
5. **Analytics Complexity**: Comparing across configuration_id instead of time-based

---

## The Solution: Single Editable Configuration

### New Data Model

```typescript
/**
 * Single system configuration
 * No versioning, no status - just settings that can be edited directly
 */
export interface SystemConfiguration {
  // Classification & Auto-Action Thresholds
  settings: {
    // Auto-action confidence thresholds
    autoDeadLowValueThreshold: number;        // Auto-mark dead if low-value confidence ≥ this
    autoDeadIrrelevantThreshold: number;      // Auto-mark dead if irrelevant confidence ≥ this
    autoForwardDuplicateThreshold: number;    // Auto-forward if duplicate confidence ≥ this
    autoForwardSupportThreshold: number;      // Auto-forward if support confidence ≥ this
    autoSendQualityThreshold: number;         // Auto-send if quality confidence ≥ this (future)
    qualityLeadConfidenceThreshold: number;   // Minimum confidence to classify as quality

    // AI Rollout Control - THE INTUITIVE LEVER
    percentAIClassification: number;  // 0-100: 0% = all human, 100% = full AI
  };

  // Email Templates
  emailTemplate: {
    subject?: string;
    greeting?: string;
    signOff?: string;
    callToAction?: string;
    lowValueTemplate?: string;  // NEW: Static template for low-value leads
  };

  // SDR Information
  sdr: {
    name: string;
    email: string;
  };

  // Simple Metadata
  updated_at: Date;
  updated_by: string;
}
```

### Why `percentAIClassification` is Better UX

**Positive Framing:**
- ✅ "AI is handling 75% of leads" (sounds capable)
- ❌ "25% of leads need human help" (sounds like failure)

**Natural Progression:**
- 0% → 25% → 50% → 75% → 90% → 100%
- The number INCREASES as AI gets better

**Clear Communication:**
- "We're at 80% AI classification" is immediately understandable
- "We have 20% human classification rate" requires mental math

**Rollout Narrative:**
- "Let's increase AI to 60%" (sounds like progress)
- vs "Let's decrease human rate to 40%" (sounds like reducing quality)

---

## Implementation Plan

### Phase 0: Data Model Changes

**Location:** `lib/types.ts`

#### 0.1 Create Simplified Configuration Type

```typescript
// NEW: Simplified configuration (replaces Configuration interface)
export interface SystemConfiguration {
  settings: {
    autoDeadLowValueThreshold: number;
    autoDeadIrrelevantThreshold: number;
    autoForwardDuplicateThreshold: number;
    autoForwardSupportThreshold: number;
    autoSendQualityThreshold: number;
    qualityLeadConfidenceThreshold: number;
    percentAIClassification: number;  // 0-100
  };

  emailTemplate: {
    subject?: string;
    greeting?: string;
    signOff?: string;
    callToAction?: string;
    lowValueTemplate?: string;
  };

  sdr: {
    name: string;
    email: string;
  };

  updated_at: Date;
  updated_by: string;
}
```

#### 0.2 Remove Old Types

```typescript
// REMOVE: These are no longer needed
// - Configuration interface (with version, status, etc.)
// - ConfigurationStatus type
// - ConfigurationMetrics interface
```

#### 0.3 Update Lead Interface

```typescript
export interface Lead {
  // ... existing fields ...

  // REMOVE: configuration_id (no longer needed)

  // KEEP: AI classification fields (from human classification plan)
  ai_classification?: LeadClassification;
  ai_confidence?: number;
  ai_reasoning?: string;
  human_classified_at?: Timestamp | Date;
  sampled_for_human?: boolean;
}
```

---

### Phase 1: Database Migration

**Goal:** Consolidate active configuration + system settings into single document

#### 1.1 Migration Script

**Location:** `scripts/migrate-to-single-config.ts` (NEW FILE)

```typescript
import { adminDb } from '@/lib/firestore-admin';
import type { SystemConfiguration } from '@/lib/types';

/**
 * Migration: Consolidate configurations into single settings document
 *
 * Takes:
 * - Currently active configuration
 * - System settings (if exists)
 *
 * Creates:
 * - Single settings/configuration document
 *
 * Archives:
 * - Old configurations (for audit trail)
 */
export async function migrateToSingleConfiguration() {
  console.log('Starting migration to single configuration...');

  // 1. Get active configuration
  const activeConfigSnapshot = await adminDb
    .collection('configurations')
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (activeConfigSnapshot.empty) {
    throw new Error('No active configuration found');
  }

  const activeConfig = activeConfigSnapshot.docs[0].data();

  // 2. Get system settings (if exists)
  const systemSettingsDoc = await adminDb
    .collection('settings')
    .doc('system')
    .get();

  const systemSettings = systemSettingsDoc.exists ? systemSettingsDoc.data() : {};

  // 3. Create consolidated configuration
  const newConfiguration: SystemConfiguration = {
    settings: {
      autoDeadLowValueThreshold: activeConfig.settings.autoDeadLowValueThreshold || 0.9,
      autoDeadIrrelevantThreshold: activeConfig.settings.autoDeadIrrelevantThreshold || 0.95,
      autoForwardDuplicateThreshold: activeConfig.settings.autoForwardDuplicateThreshold || 0.9,
      autoForwardSupportThreshold: activeConfig.settings.autoForwardSupportThreshold || 0.9,
      autoSendQualityThreshold: activeConfig.settings.autoSendQualityThreshold || 0.95,
      qualityLeadConfidenceThreshold: activeConfig.settings.qualityLeadConfidenceThreshold || 0.7,
      percentAIClassification: 0,  // Start at 0% (full human validation during rollout)
    },
    emailTemplate: activeConfig.emailTemplate || {},
    sdr: systemSettings.sdr || {
      name: 'Ryan',
      email: 'ryan@vercel.com'
    },
    updated_at: new Date(),
    updated_by: 'migration_script',
  };

  // 4. Write new configuration
  await adminDb
    .collection('settings')
    .doc('configuration')
    .set(newConfiguration);

  console.log('✅ Created new single configuration');

  // 5. Archive old configurations (keep for audit)
  const allConfigs = await adminDb.collection('configurations').get();
  const batch = adminDb.batch();

  allConfigs.docs.forEach(doc => {
    batch.update(doc.ref, {
      status: 'archived',
      archived_at: new Date(),
      migration_note: 'Archived during migration to single configuration system'
    });
  });

  await batch.commit();
  console.log(`✅ Archived ${allConfigs.size} old configurations`);

  // 6. Remove system settings doc (now consolidated)
  if (systemSettingsDoc.exists) {
    await systemSettingsDoc.ref.delete();
    console.log('✅ Removed old system settings document');
  }

  console.log('Migration complete!');
}
```

#### 1.2 Run Migration

```bash
npx tsx scripts/migrate-to-single-config.ts
```

---

### Phase 2: Update Configuration Helpers

**Location:** `lib/configuration-helpers.ts`

#### 2.1 Simplify to Single Configuration

```typescript
import { adminDb } from "./firestore-admin";
import type { SystemConfiguration } from "./types";

// Simple cache (no need for complex caching - settings don't change often)
let configCache: SystemConfiguration | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 60 * 1000; // 60 seconds

/**
 * Get the system configuration
 * Cached for 60 seconds to improve performance
 */
export async function getConfiguration(): Promise<SystemConfiguration> {
  const now = Date.now();

  // Return cached if valid
  if (configCache && now - cacheTimestamp < CACHE_DURATION_MS) {
    return configCache;
  }

  try {
    const doc = await adminDb
      .collection('settings')
      .doc('configuration')
      .get();

    if (!doc.exists) {
      throw new Error('Configuration not found. Please run initialization.');
    }

    const configuration = doc.data() as SystemConfiguration;

    // Update cache
    configCache = configuration;
    cacheTimestamp = now;

    return configuration;
  } catch (error) {
    console.error('Error fetching configuration:', error);
    throw error;
  }
}

/**
 * Update system configuration
 */
export async function updateConfiguration(
  updates: Partial<SystemConfiguration>,
  updatedBy: string = 'system'
): Promise<void> {
  try {
    await adminDb
      .collection('settings')
      .doc('configuration')
      .update({
        ...updates,
        updated_at: new Date(),
        updated_by: updatedBy,
      });

    // Invalidate cache
    invalidateConfigurationCache();

    console.log('Configuration updated successfully');
  } catch (error) {
    console.error('Error updating configuration:', error);
    throw error;
  }
}

/**
 * Invalidate configuration cache
 */
export function invalidateConfigurationCache() {
  configCache = null;
  cacheTimestamp = 0;
}

/**
 * Initialize default configuration (for new setups)
 */
export async function initializeConfiguration(): Promise<void> {
  const defaultConfig: SystemConfiguration = {
    settings: {
      autoDeadLowValueThreshold: 0.9,
      autoDeadIrrelevantThreshold: 0.95,
      autoForwardDuplicateThreshold: 0.9,
      autoForwardSupportThreshold: 0.9,
      autoSendQualityThreshold: 0.95,
      qualityLeadConfidenceThreshold: 0.7,
      percentAIClassification: 0,  // Start with 0% AI (full human validation)
    },
    emailTemplate: {
      subject: "Hi from Vercel",
      greeting: "Hi {firstName},",
      signOff: "Best,",
      callToAction: "Let's schedule a quick 15-minute call to discuss how Vercel can help.",
    },
    sdr: {
      name: 'Ryan',
      email: 'ryan@vercel.com'
    },
    updated_at: new Date(),
    updated_by: 'system',
  };

  await adminDb
    .collection('settings')
    .doc('configuration')
    .set(defaultConfig);

  console.log('Default configuration initialized');
}
```

#### 2.2 Update All Imports

**Find and replace:**
```bash
# Find all usages
grep -r "getActiveConfiguration" nextjs-app/

# Replace with
getConfiguration
```

**Files to update:**
- `workflows/inbound/steps.ts`
- `app/api/leads/submit/route.ts`
- `lib/workflow-services.ts`
- Any other files using configurations

---

### Phase 3: Remove Configuration Management

#### 3.1 Delete These Files

```bash
# UI Components
rm nextjs-app/app/dashboard/configurations/[id]/page.tsx
rm nextjs-app/app/dashboard/configurations/new/page.tsx
rm nextjs-app/components/dashboard/Configurations.tsx

# API Routes
rm nextjs-app/app/api/configurations/route.ts
rm nextjs-app/app/api/configurations/[id]/route.ts
rm nextjs-app/app/api/configurations/[id]/activate/route.ts
rm nextjs-app/app/api/configurations/[id]/archive/route.ts
```

#### 3.2 Delete Old Helper File

```bash
rm nextjs-app/lib/account-settings.ts
```

---

### Phase 4: Create New Settings UI

#### 4.1 Settings Page

**Location:** `app/dashboard/settings/page.tsx` (NEW FILE)

```typescript
'use client';

import { useEffect, useState } from 'react';
import type { SystemConfiguration } from '@/lib/types';
import { DEFAULT_LOW_VALUE_TEMPLATE } from '@/lib/email-templates';

export default function SettingsPage() {
  const [config, setConfig] = useState<SystemConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [percentAI, setPercentAI] = useState(0);
  const [autoDeadLowValue, setAutoDeadLowValue] = useState(0.9);
  const [autoDeadIrrelevant, setAutoDeadIrrelevant] = useState(0.95);
  const [autoForwardDuplicate, setAutoForwardDuplicate] = useState(0.9);
  const [autoForwardSupport, setAutoForwardSupport] = useState(0.9);
  const [autoSendQuality, setAutoSendQuality] = useState(0.95);
  const [qualityThreshold, setQualityThreshold] = useState(0.7);
  const [lowValueTemplate, setLowValueTemplate] = useState('');
  const [sdrName, setSdrName] = useState('');
  const [sdrEmail, setSdrEmail] = useState('');

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

        // Populate form
        setPercentAI(data.configuration.settings.percentAIClassification);
        setAutoDeadLowValue(data.configuration.settings.autoDeadLowValueThreshold);
        setAutoDeadIrrelevant(data.configuration.settings.autoDeadIrrelevantThreshold);
        setAutoForwardDuplicate(data.configuration.settings.autoForwardDuplicateThreshold);
        setAutoForwardSupport(data.configuration.settings.autoForwardSupportThreshold);
        setAutoSendQuality(data.configuration.settings.autoSendQualityThreshold);
        setQualityThreshold(data.configuration.settings.qualityLeadConfidenceThreshold);
        setLowValueTemplate(data.configuration.emailTemplate.lowValueTemplate || DEFAULT_LOW_VALUE_TEMPLATE);
        setSdrName(data.configuration.sdr.name);
        setSdrEmail(data.configuration.sdr.email);
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
          settings: {
            percentAIClassification: percentAI,
            autoDeadLowValueThreshold: autoDeadLowValue,
            autoDeadIrrelevantThreshold: autoDeadIrrelevant,
            autoForwardDuplicateThreshold: autoForwardDuplicate,
            autoForwardSupportThreshold: autoForwardSupport,
            autoSendQualityThreshold: autoSendQuality,
            qualityLeadConfidenceThreshold: qualityThreshold,
          },
          emailTemplate: {
            ...config?.emailTemplate,
            lowValueTemplate,
          },
          sdr: {
            name: sdrName,
            email: sdrEmail,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage('Settings saved successfully!');
        loadSettings(); // Reload to get updated timestamp
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

  if (loading) {
    return <div className="p-8">Loading settings...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">System Settings</h1>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
          {successMessage}
        </div>
      )}

      <div className="space-y-8">
        {/* AI Classification Rollout */}
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">🤖 AI Classification Rollout</h2>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              AI Classification Rate: {percentAI}%
            </label>
            <p className="text-sm text-gray-600 mb-4">
              Percentage of leads classified by AI. The rest are routed to human classification for validation.
            </p>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={percentAI}
              onChange={(e) => setPercentAI(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0% (All Human)</span>
              <span>50% (A/B Test)</span>
              <span>100% (Full AI)</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm">
            <p className="font-medium text-blue-900 mb-1">Current Status:</p>
            <p className="text-blue-800">
              {percentAI === 0 && 'All leads go to human classification (full validation mode)'}
              {percentAI > 0 && percentAI < 100 && `AI handles ${percentAI}% of leads, ${100 - percentAI}% routed to human for quality testing`}
              {percentAI === 100 && 'Full AI automation (only uncertain leads go to human)'}
            </p>
          </div>
        </section>

        {/* Auto-Action Thresholds */}
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">⚙️ Auto-Action Thresholds</h2>
          <p className="text-sm text-gray-600 mb-6">
            Confidence thresholds for automatic actions. Leads below these thresholds require human review.
          </p>

          <div className="space-y-6">
            <ThresholdInput
              label="Auto-Dead (Low-Value)"
              value={autoDeadLowValue}
              onChange={setAutoDeadLowValue}
              description="Automatically mark low-value leads as dead if confidence ≥ this threshold"
            />

            <ThresholdInput
              label="Auto-Dead (Irrelevant/Spam)"
              value={autoDeadIrrelevant}
              onChange={setAutoDeadIrrelevant}
              description="Automatically mark irrelevant/spam leads as dead if confidence ≥ this threshold"
            />

            <ThresholdInput
              label="Auto-Forward (Duplicate)"
              value={autoForwardDuplicate}
              onChange={setAutoForwardDuplicate}
              description="Automatically forward duplicate leads to account team if confidence ≥ this threshold"
            />

            <ThresholdInput
              label="Auto-Forward (Support)"
              value={autoForwardSupport}
              onChange={setAutoForwardSupport}
              description="Automatically forward support requests if confidence ≥ this threshold"
            />

            <ThresholdInput
              label="Quality Lead Minimum Confidence"
              value={qualityThreshold}
              onChange={setQualityThreshold}
              description="Minimum confidence to classify as quality lead (not for auto-action)"
            />
          </div>
        </section>

        {/* Email Templates */}
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">📧 Email Templates</h2>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Low-Value Email Template
            </label>
            <p className="text-sm text-gray-600 mb-4">
              Static template for low-value leads. Available variables: {'{firstName}'}, {'{company}'}, {'{sdrName}'}
            </p>
            <textarea
              value={lowValueTemplate}
              onChange={(e) => setLowValueTemplate(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded font-mono text-sm"
              rows={12}
            />
          </div>
        </section>

        {/* SDR Information */}
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">👤 SDR Information</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">SDR Name</label>
              <input
                type="text"
                value={sdrName}
                onChange={(e) => setSdrName(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">SDR Email</label>
              <input
                type="email"
                value={sdrEmail}
                onChange={(e) => setSdrEmail(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <button
            onClick={loadSettings}
            disabled={saving}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* Last Updated */}
        {config && (
          <div className="text-sm text-gray-500 text-right">
            Last updated: {new Date(config.updated_at).toLocaleString()} by {config.updated_by}
          </div>
        )}
      </div>
    </div>
  );
}

function ThresholdInput({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium">{label}</label>
        <span className="text-lg font-bold text-gray-900">{value.toFixed(2)}</span>
      </div>
      <p className="text-xs text-gray-600 mb-2">{description}</p>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>0.00 (Never)</span>
        <span>0.50</span>
        <span>1.00 (Always)</span>
      </div>
    </div>
  );
}
```

#### 4.2 Settings API Route

**Location:** `app/api/settings/route.ts` (NEW FILE)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getConfiguration, updateConfiguration } from '@/lib/configuration-helpers';

// GET /api/settings - Get current configuration
export async function GET(request: NextRequest) {
  try {
    const configuration = await getConfiguration();

    return NextResponse.json({
      success: true,
      configuration,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch settings',
      },
      { status: 500 }
    );
  }
}

// PATCH /api/settings - Update configuration
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    // Get user from middleware (or hardcoded for now)
    const userEmail = request.headers.get('x-user-email') || 'system';

    // Update configuration
    await updateConfiguration(body, userEmail);

    // Return updated configuration
    const updatedConfig = await getConfiguration();

    return NextResponse.json({
      success: true,
      configuration: updatedConfig,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update settings',
      },
      { status: 500 }
    );
  }
}
```

---

### Phase 5: Update Workflow Integration

**Location:** `workflows/inbound/steps.ts`

#### 5.1 Update Autonomy Determination Step

```typescript
export const stepDetermineAutonomyAndOutcome = async (
  classification: ClassificationResult
) => {
  'use step';

  console.log(`[Workflow] Determining autonomy and outcome`);

  // Get configuration settings for auto-action thresholds
  const { getConfiguration } = await import('@/lib/configuration-helpers');
  const config = await getConfiguration();  // ← Changed from getActiveConfiguration()

  const autoDeadLowValueThreshold = config.settings.autoDeadLowValueThreshold;
  const autoDeadIrrelevantThreshold = config.settings.autoDeadIrrelevantThreshold;
  const autoForwardDuplicateThreshold = config.settings.autoForwardDuplicateThreshold;
  const autoForwardSupportThreshold = config.settings.autoForwardSupportThreshold;

  // ... rest of logic remains the same
};
```

#### 5.2 Add AI Classification Sampling Logic

**Location:** `app/api/leads/submit/route.ts` (after workflow completes)

```typescript
// After workflow runs, determine if lead should go to human classification
const config = await getConfiguration();

// Determine if this lead should use AI classification or go to human
const useAI = Math.random() * 100 < config.settings.percentAIClassification;

if (!useAI && workflow.qualification.classification !== 'uncertain') {
  // Route to human classification (except uncertain - those always go to human anyway)
  console.log(`[Submit] Lead sampled for human classification (AI rate: ${config.settings.percentAIClassification}%)`);

  await updateDoc(leadRef, {
    // Store AI classification for comparison
    ai_classification: workflow.qualification.classification,
    ai_confidence: workflow.qualification.confidence,
    ai_reasoning: workflow.qualification.reasoning,

    // Mark as needing human classification
    sampled_for_human: true,
    outcome: 'needs_classification',
    autonomy: null,
  });

  return NextResponse.json({
    success: true,
    leadId: leadRef.id,
    message: 'Lead submitted for human classification',
  });
}

// Continue with normal AI classification flow
```

---

### Phase 6: Update Navigation

**Location:** `app/dashboard/layout.tsx` (or wherever nav is defined)

```typescript
// BEFORE
<NavLink href="/dashboard/configurations">Configurations</NavLink>

// AFTER
<NavLink href="/dashboard/settings">Settings</NavLink>
```

---

## Integration with Human Classification Workflow

### Combined Implementation Order

Implement both plans together in this order:

1. **Phase 0-1**: Data model changes + migration (this plan)
2. **Phase 2**: Configuration helpers simplification (this plan)
3. **Phase 3-4**: Human classification data model (original plan)
4. **Phase 5**: Human classification workflow logic (original plan)
5. **Phase 6**: Settings UI with `percentAIClassification` (this plan)
6. **Phase 7**: Human classification UI (original plan)
7. **Phase 8**: Analytics for human vs AI comparison (original plan)

### Key Differences from Original Plan

| Original Plan | This Plan |
|--------------|-----------|
| `humanClassificationRate` | `percentAIClassification` |
| Multiple configurations | Single configuration |
| Configuration versioning | Direct editing |
| Draft → Active workflow | Edit → Save |
| A/B test via configs | A/B test via percentage slider |

### What Stays Exactly the Same

- ✅ `needs_classification` outcome
- ✅ AI fields (`ai_classification`, `ai_confidence`, `ai_reasoning`)
- ✅ `sampled_for_human` flag
- ✅ Classify UI (show/hide AI prediction based on sampling)
- ✅ Post-classification actions
- ✅ Low-value email templates
- ✅ Human vs AI comparison analytics
- ✅ All classification improvements (prompts, spam detection, etc.)

---

## Rollout Strategy

### Phase 1: Validation (0% AI)
**Duration:** 1-2 weeks

```
Settings: percentAIClassification = 0%
Result: All leads → human classification
Goal: Build confidence, validate thresholds
```

### Phase 2: A/B Testing (50% AI)
**Duration:** 1-2 weeks

```
Settings: percentAIClassification = 50%
Result: Half to AI, half to human
Goal: Measure human vs AI agreement rate
```

### Phase 3: Gradual Rollout (50% → 90%)
**Duration:** 4-6 weeks

```
Week 1: 50% → 60%
Week 2: 60% → 70%
Week 3: 70% → 80%
Week 4: 80% → 90%
Goal: Gradual increase based on confidence
```

### Phase 4: Production (90-95% AI)
**Duration:** Ongoing

```
Settings: percentAIClassification = 90%
Result: AI handles 90%, humans spot-check 10%
Goal: Ongoing quality monitoring
```

### Phase 5: Full Automation (100% AI)
**Duration:** When ready

```
Settings: percentAIClassification = 100%
Result: Only uncertain leads go to human
Goal: Full automation with human oversight for edge cases
```

---

## Success Metrics

### Implementation Success
- [ ] Single configuration document exists in `settings/configuration`
- [ ] All old configurations archived (for audit trail)
- [ ] Settings page allows direct editing
- [ ] `percentAIClassification` slider works (0-100%)
- [ ] No draft/active/archived logic
- [ ] Navigation updated to "Settings"

### Rollout Success
- [ ] 0% AI: All leads go to human ✅
- [ ] 50% AI: ~50% to human (random sampling) ✅
- [ ] Human vs AI agreement rate measured ✅
- [ ] Can increase percentage without code changes ✅
- [ ] Analytics show human vs AI comparison ✅

---

## Files Summary

### Create
- `scripts/migrate-to-single-config.ts` - Migration script
- `app/dashboard/settings/page.tsx` - Settings UI
- `app/api/settings/route.ts` - Settings API
- `lib/email-templates.ts` - Default templates (if not exists)

### Delete
- `app/dashboard/configurations/[id]/page.tsx`
- `app/dashboard/configurations/new/page.tsx`
- `components/dashboard/Configurations.tsx`
- `app/api/configurations/route.ts`
- `app/api/configurations/[id]/route.ts`
- `app/api/configurations/[id]/activate/route.ts`
- `app/api/configurations/[id]/archive/route.ts`
- `lib/account-settings.ts`

### Modify
- `lib/types.ts` - New SystemConfiguration type
- `lib/configuration-helpers.ts` - Simplified helpers
- `workflows/inbound/steps.ts` - Use getConfiguration()
- `app/api/leads/submit/route.ts` - Add sampling logic
- `app/dashboard/layout.tsx` - Update navigation
- All files using `getActiveConfiguration()` → `getConfiguration()`

---

## Testing Plan

### Migration Testing
1. Run migration script on test data
2. Verify old active config merged with system settings
3. Verify all old configs archived
4. Verify new settings document created

### Settings UI Testing
1. Load settings page
2. Edit each threshold
3. Save and verify database updated
4. Reload page and verify changes persisted

### Sampling Testing
1. Set `percentAIClassification: 0%` → Submit 10 leads → All should go to human
2. Set `percentAIClassification: 50%` → Submit 100 leads → ~50 should go to human
3. Set `percentAIClassification: 100%` → Submit 10 leads → None should go to human (unless uncertain)

### Backward Compatibility
1. Verify old leads display correctly
2. Verify analytics still work
3. Verify no broken references to configuration_id

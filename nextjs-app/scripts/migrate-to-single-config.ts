/**
 * Migration Script: Consolidate to Single Configuration
 *
 * This script:
 * 1. Takes the currently active configuration
 * 2. Merges with system settings (if exists)
 * 3. Creates new single configuration at settings/configuration
 * 4. Archives old configurations (for audit trail)
 *
 * Run with: npx tsx scripts/migrate-to-single-config.ts
 */

import { adminDb } from '../lib/firestore-admin';
import type { Configuration } from '../lib/types';
import { DEFAULT_CONFIGURATION } from '../lib/types';

async function migrateToSingleConfiguration() {
  console.log('🚀 Starting migration to single configuration...\n');

  try {
    // Step 1: Get active configuration
    console.log('Step 1: Fetching active configuration...');
    const activeConfigSnapshot = await adminDb
      .collection('configurations')
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (activeConfigSnapshot.empty) {
      console.log('⚠️  No active configuration found. Creating default configuration...');

      // Create default configuration
      const defaultConfig: Configuration = {
        ...DEFAULT_CONFIGURATION,
        updated_at: new Date(),
        updated_by: 'migration_script',
      };

      await adminDb
        .collection('settings')
        .doc('configuration')
        .set(defaultConfig);

      console.log('✅ Default configuration created\n');
      console.log('Migration complete! No configurations to archive.\n');
      return;
    }

    const activeConfig = activeConfigSnapshot.docs[0].data();
    console.log(`✅ Found active configuration: ${activeConfig.name || activeConfigSnapshot.docs[0].id}\n`);

    // Step 2: Get system settings (if exists)
    console.log('Step 2: Checking for system settings...');
    const systemSettingsDoc = await adminDb
      .collection('settings')
      .doc('system')
      .get();

    const systemSettings = systemSettingsDoc.exists ? systemSettingsDoc.data() : null;
    if (systemSettings) {
      console.log('✅ Found system settings\n');
    } else {
      console.log('⚠️  No system settings found, using defaults\n');
    }

    // Step 3: Create consolidated configuration
    console.log('Step 3: Creating consolidated configuration...');
    const oldConfig = activeConfig as any;
    const newConfiguration: Configuration = {
      ...DEFAULT_CONFIGURATION,
      thresholds: {
        highQuality: oldConfig.settings?.autoSendQualityThreshold || DEFAULT_CONFIGURATION.thresholds.highQuality,
        lowQuality: oldConfig.settings?.autoDeadLowValueThreshold || DEFAULT_CONFIGURATION.thresholds.lowQuality,
        support: oldConfig.settings?.autoForwardSupportThreshold || DEFAULT_CONFIGURATION.thresholds.support,
        duplicate: oldConfig.settings?.autoForwardDuplicateThreshold || DEFAULT_CONFIGURATION.thresholds.duplicate,
        irrelevant: oldConfig.settings?.autoDeadIrrelevantThreshold || DEFAULT_CONFIGURATION.thresholds.irrelevant,
      },
      emailTemplates: {
        highQuality: {
          ...DEFAULT_CONFIGURATION.emailTemplates.highQuality,
          subject: oldConfig.emailTemplate?.subject || DEFAULT_CONFIGURATION.emailTemplates.highQuality.subject,
          greeting: oldConfig.emailTemplate?.greeting || DEFAULT_CONFIGURATION.emailTemplates.highQuality.greeting,
          signOff: oldConfig.emailTemplate?.signOff || DEFAULT_CONFIGURATION.emailTemplates.highQuality.signOff,
        },
        lowQuality: {
          ...DEFAULT_CONFIGURATION.emailTemplates.lowQuality,
          subject: oldConfig.emailTemplate?.subject || DEFAULT_CONFIGURATION.emailTemplates.lowQuality.subject,
          greeting: oldConfig.emailTemplate?.greeting || DEFAULT_CONFIGURATION.emailTemplates.lowQuality.greeting,
          signOff: oldConfig.emailTemplate?.signOff || DEFAULT_CONFIGURATION.emailTemplates.lowQuality.signOff,
          callToAction: oldConfig.emailTemplate?.lowValueTemplate || DEFAULT_CONFIGURATION.emailTemplates.lowQuality.callToAction,
        },
        support: DEFAULT_CONFIGURATION.emailTemplates.support,
        duplicate: DEFAULT_CONFIGURATION.emailTemplates.duplicate,
      },
      sdr: (systemSettings as any)?.sdr || DEFAULT_CONFIGURATION.sdr,
      rollout: {
        enabled: false,
        percentage: oldConfig.settings?.percentAIClassification || 0,
      },
      updated_at: new Date(),
      updated_by: 'migration_script',
    };

    // Write new configuration
    await adminDb
      .collection('settings')
      .doc('configuration')
      .set(newConfiguration);

    console.log('✅ Created new single configuration at settings/configuration\n');

    // Step 4: Archive old configurations
    console.log('Step 4: Archiving old configurations...');
    const allConfigs = await adminDb.collection('configurations').get();

    if (!allConfigs.empty) {
      const batch = adminDb.batch();

      allConfigs.docs.forEach(doc => {
        batch.update(doc.ref, {
          status: 'archived',
          archived_at: new Date(),
          migration_note: 'Archived during migration to single configuration system'
        });
      });

      await batch.commit();
      console.log(`✅ Archived ${allConfigs.size} old configuration(s)\n`);
    } else {
      console.log('⚠️  No old configurations to archive\n');
    }

    // Step 5: Remove old system settings doc (now consolidated)
    if (systemSettingsDoc.exists) {
      console.log('Step 5: Removing old system settings document...');
      await systemSettingsDoc.ref.delete();
      console.log('✅ Removed old system settings document\n');
    }

    // Summary
    console.log('🎉 Migration complete!\n');
    console.log('Summary:');
    console.log('  ✅ New configuration created at: settings/configuration');
    console.log(`  ✅ Old configurations archived: ${allConfigs.size}`);
    console.log(`  ✅ Starting with ${(newConfiguration.rollout.percentage * 100).toFixed(0)}% AI classification`);
    console.log('\nNext steps:');
    console.log('  1. Update workflow code to use getConfiguration() instead of getActiveConfiguration()');
    console.log('  2. Deploy Settings UI to allow editing percentAIClassification');
    console.log('  3. Test the new configuration system');
    console.log('  4. Gradually increase percentAIClassification as confidence grows\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateToSingleConfiguration()
  .then(() => {
    console.log('Migration script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });

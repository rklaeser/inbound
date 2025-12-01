// POST /api/leads/[id]/classify
// Handle human classification for leads that need manual classification

import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/db';
import type { Lead, Classification, ClassificationEntry } from '@/lib/types';
import { successResponse, ApiErrors } from '@/lib/api';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { classification } = await request.json();
    const { id: leadId } = await params;

    if (!classification) {
      return ApiErrors.badRequest('Classification is required');
    }

    // Validate classification value
    // Note: 'duplicate' is not a valid human classification - duplicates are detected
    // automatically via CRM lookup before classification runs
    const validClassifications: Classification[] = ['high-quality', 'low-quality', 'support'];
    if (!validClassifications.includes(classification)) {
      return ApiErrors.badRequest('Invalid classification');
    }

    // Get lead
    const leadDoc = await adminDb.collection('leads').doc(leadId).get();
    if (!leadDoc.exists) {
      return ApiErrors.notFound('Lead');
    }

    const lead = { id: leadDoc.id, ...leadDoc.data() } as Lead;

    const now = new Date();

    // Create human classification entry
    const humanClassificationEntry: ClassificationEntry = {
      author: 'human',
      classification: classification as Classification,
      timestamp: now,
    };

    // Build update data
    const updateData: Record<string, unknown> = {};

    // Add human classification to front of array
    const updatedClassifications = [humanClassificationEntry, ...lead.classifications];
    updateData.classifications = updatedClassifications;

    let responseMessage = '';

    // Execute post-classification action based on classification
    switch (classification as Classification) {
      case 'high-quality': {
        // Generate personalized email for approval
        const { generateEmailForLead } = await import('@/lib/workflow-services');
        const { getConfiguration } = await import('@/lib/configuration-helpers');
        const { extractFirstName, assembleEmail } = await import('@/lib/email');

        try {
          const emailResult = await generateEmailForLead({
            name: lead.submission.leadName,
            email: lead.submission.email,
            company: lead.submission.company,
            message: lead.submission.message,
          });

          // Assemble the full email (greeting + body + CTA + signoff + signature)
          // Note: Case studies are NOT included - they're appended at send time
          const config = await getConfiguration();
          const firstName = extractFirstName(lead.submission.leadName);
          const fullEmail = assembleEmail(
            emailResult.body,
            {
              greeting: config.emailTemplates.highQuality.greeting,
              callToAction: config.emailTemplates.highQuality.callToAction,
              signOff: config.emailTemplates.highQuality.signOff,
              senderName: config.sdr.name,
              senderLastName: config.sdr.lastName,
              senderEmail: config.sdr.email,
              senderTitle: config.sdr.title,
            },
            firstName,
            leadId
            // Case studies omitted - appended at send time
          );

          // Store the fully assembled email
          updateData['email.text'] = fullEmail;
          updateData['email.createdAt'] = now;
          updateData['email.editedAt'] = now;

          // Stay in review for email approval
          updateData['status.status'] = 'review';

          responseMessage = 'Email generated for approval';
        } catch (error) {
          console.error('[Classify] Error generating email:', error);
          responseMessage = 'Classification saved, but email generation failed';
        }
        break;
      }

      case 'low-quality': {
        // Low-quality leads use static template and auto-send
        const { getConfiguration } = await import('@/lib/configuration-helpers');
        const { sendLowQualityEmail } = await import('@/lib/email/classification-emails');

        updateData['status.status'] = 'done';
        updateData['status.sent_at'] = now;

        try {
          const config = await getConfiguration();
          const testModeEmail = config.email.testMode ? config.email.testEmail : null;
          const result = await sendLowQualityEmail({ lead, config, testModeEmail });

          if (result.success) {
            responseMessage = 'Generic email sent';
          } else {
            responseMessage = 'Classification saved, but email sending failed';
          }
        } catch (error) {
          console.error('[Classify] Error sending low-quality email:', error);
          responseMessage = 'Classification saved, but email sending failed';
        }
        break;
      }

      case 'support': {
        // Auto-forward to support - mark as done
        updateData['status.status'] = 'done';
        updateData['status.sent_at'] = now;

        responseMessage = 'Forwarded to support team';
        break;
      }

    }

    // Log human vs AI comparison if this lead has bot research (AI classification)
    // This handles both cases:
    // 1. Bot classified first (in classifications array) - human is overriding
    // 2. AI ran silently for comparison (bot_research exists but not in classifications)
    if (lead.bot_research?.classification) {
      const aiClassification = lead.bot_research.classification;
      const agreement = aiClassification === classification;

      // Determine the comparison type
      const comparisonType = lead.classifications.length > 0 && lead.classifications[0].author === 'bot'
        ? 'override'  // Human is overriding bot's authoritative classification
        : 'blind';    // Human classified without seeing bot (bot ran silently)

      // Log analytics event
      await adminDb.collection('analytics_events').add({
        lead_id: leadId,
        event_type: 'human_ai_comparison',
        data: {
          ai_classification: aiClassification,
          ai_confidence: lead.bot_research.confidence,
          human_classification: classification,
          agreement,
          confidence_bucket: getConfidenceBucket(lead.bot_research.confidence),
          comparison_type: comparisonType,
        },
        recorded_at: now,
      });

      console.log(
        `[Classify] Human vs AI comparison (${comparisonType}): ${agreement ? 'Agreement' : 'Disagreement'} (AI: ${aiClassification}, Human: ${classification})`
      );
    }

    // Update lead in database
    await adminDb.collection('leads').doc(leadId).update(updateData);

    console.log(`[Classify] Lead ${leadId} classified as ${classification}`);

    return successResponse({ classification, message: responseMessage });
  } catch (error) {
    console.error('Error classifying lead:', error);
    return ApiErrors.internal('Failed to classify lead');
  }
}

/**
 * Helper function to bucket confidence scores
 */
function getConfidenceBucket(confidence: number): string {
  if (confidence < 0.5) return '0-50%';
  if (confidence < 0.7) return '50-70%';
  if (confidence < 0.9) return '70-90%';
  return '90-100%';
}

// POST /api/leads/[id]/classify
// Handle human classification for leads that need manual classification

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firestore-admin';
import type { Lead, Classification, ClassificationEntry, BotText } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { classification } = await request.json();
    const { id: leadId } = await params;

    if (!classification) {
      return NextResponse.json(
        { success: false, error: 'Classification is required' },
        { status: 400 }
      );
    }

    // Validate classification value
    const validClassifications: Classification[] = ['high-quality', 'low-quality', 'support', 'duplicate', 'irrelevant'];
    if (!validClassifications.includes(classification)) {
      return NextResponse.json(
        { success: false, error: 'Invalid classification' },
        { status: 400 }
      );
    }

    // Get lead
    const leadDoc = await adminDb.collection('leads').doc(leadId).get();
    if (!leadDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
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

        try {
          const email = await generateEmailForLead(
            {
              name: lead.submission.leadName,
              email: lead.submission.email,
              company: lead.submission.company,
              message: lead.submission.message,
            },
            lead.bot_research?.reasoning || '',
            {
              classification: 'high-quality',
              confidence: 0.99,
              reasoning: 'Human classified as high-quality lead',
            }
          );

          // Store in bot_text (replace {leadId} placeholder with actual lead ID)
          const botText: BotText = {
            highQualityText: email.body.replace(/{leadId}/g, leadId),
            lowQualityText: null,  // No longer used - low-quality uses static template
          };
          updateData.bot_text = botText;

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
        const { sendEmail } = await import('@/lib/send-email');

        updateData['status.status'] = 'done';
        updateData['status.sent_at'] = now;

        // Send generic email using static HTML template
        try {
          const config = await getConfiguration();
          if (config.email.enabled) {
            const template = config.emailTemplates.lowQuality;
            const testModeEmail = config.email.testMode ? config.email.testEmail : null;

            await sendEmail(
              {
                to: lead.submission.email,
                fromName: template.senderName,
                fromEmail: template.senderEmail,
                subject: template.subject,
                html: template.body,
              },
              testModeEmail
            );
          }
          responseMessage = 'Generic email sent';
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

      case 'duplicate': {
        // Auto-forward to account team - mark as done
        updateData['status.status'] = 'done';
        updateData['status.sent_at'] = now;

        responseMessage = 'Forwarded to account team';
        break;
      }

      case 'irrelevant': {
        // Mark as dead - done
        updateData['status.status'] = 'done';
        updateData['status.sent_at'] = now;

        responseMessage = 'Lead marked as dead';
        break;
      }
    }

    // Log human vs AI comparison if this lead has bot classification
    if (lead.classifications.length > 0 && lead.classifications[0].author === 'bot') {
      const botClassification = lead.classifications[0].classification;
      const agreement = botClassification === classification;

      // Log analytics event
      await adminDb.collection('analytics_events').add({
        lead_id: leadId,
        event_type: 'human_ai_comparison',
        data: {
          ai_classification: botClassification,
          ai_confidence: lead.bot_research?.confidence || 0,
          human_classification: classification,
          agreement,
          confidence_bucket: getConfidenceBucket(lead.bot_research?.confidence || 0),
        },
        recorded_at: now,
      });

      console.log(
        `[Classify] Human vs AI comparison: ${agreement ? 'Agreement' : 'Disagreement'} (AI: ${botClassification}, Human: ${classification})`
      );
    }

    // Update lead in database
    await adminDb.collection('leads').doc(leadId).update(updateData);

    console.log(`[Classify] Lead ${leadId} classified as ${classification}`);

    return NextResponse.json({
      success: true,
      classification,
      message: responseMessage,
    });
  } catch (error) {
    console.error('Error classifying lead:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to classify lead' },
      { status: 500 }
    );
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

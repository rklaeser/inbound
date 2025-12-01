// POST /api/leads/[id]/classify
// Handle human classification for leads that need manual classification

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firestore-admin';
import type { Lead, Classification, ClassificationEntry } from '@/lib/types';

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
    // Note: 'duplicate' is not a valid human classification - duplicates are detected
    // automatically via CRM lookup before classification runs
    const validClassifications: Classification[] = ['high-quality', 'low-quality', 'support'];
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
        const { getConfiguration } = await import('@/lib/configuration-helpers');
        const { extractFirstName, assembleEmail } = await import('@/lib/email-helpers');

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
        const { sendEmail } = await import('@/lib/send-email');
        const { extractFirstName, renderCaseStudiesHtml, caseStudyToMatchedCaseStudy } = await import('@/lib/email-helpers');
        const { getCaseStudyByIdServer } = await import('@/lib/firestore-server');

        updateData['status.status'] = 'done';
        updateData['status.sent_at'] = now;

        // Send generic email using static HTML template
        try {
          const config = await getConfiguration();
          if (config.email.enabled) {
            const template = config.emailTemplates.lowQuality;
            const testModeEmail = config.email.testMode ? config.email.testEmail : null;
            const firstName = extractFirstName(lead.submission.leadName);

            // Fill in {firstName} placeholder
            let emailBody = template.body.replace(/{firstName}/g, firstName);

            // Add default case study if configured
            if (config.defaultCaseStudyId) {
              const defaultCaseStudy = await getCaseStudyByIdServer(config.defaultCaseStudyId);
              if (defaultCaseStudy) {
                const matchedCaseStudy = caseStudyToMatchedCaseStudy(defaultCaseStudy);
                emailBody += renderCaseStudiesHtml([matchedCaseStudy]);
              }
            }

            await sendEmail(
              {
                to: lead.submission.email,
                fromName: template.senderName,
                fromEmail: template.senderEmail,
                subject: template.subject,
                html: emailBody,
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

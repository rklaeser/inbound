'use server';

import { adminDb } from '@/lib/db';
import type { Lead, Reroute, RerouteSource } from '@/lib/types';
import { getTerminalState } from '@/lib/types';

export type FeedbackState = {
  success: boolean;
  error?: string;
};

export async function submitFeedback(
  leadId: string,
  _prevState: FeedbackState | null,
  formData: FormData
): Promise<FeedbackState> {
  const source = formData.get('source') as 'customer' | 'support' | 'sales';
  const reason = formData.get('reason') as string | null;
  const selfService = formData.get('selfService') === 'true';

  try {
    // Customer feedback requires a reason
    if (source === 'customer' && !reason?.trim()) {
      return { success: false, error: 'Reason is required for customer feedback' };
    }

    // Check if lead exists
    const leadDoc = await adminDb.collection('leads').doc(leadId).get();

    if (!leadDoc.exists) {
      return { success: false, error: 'Lead not found' };
    }

    const lead = { id: leadDoc.id, ...leadDoc.data() } as Lead;
    const currentClassification = lead.classifications[0]?.classification;

    // Handle self-service (support only)
    if (source === 'support' && selfService) {
      // Verify this is a support-classified lead
      if (currentClassification !== 'support') {
        return { success: false, error: 'Self-service option is only available for support-classified leads' };
      }

      // Check if already marked as self-service
      if (lead.supportFeedback?.markedSelfService) {
        return { success: false, error: 'This lead has already been marked as self-service' };
      }

      // Just record the feedback - don't change classification or send emails
      await adminDb.collection('leads').doc(leadId).update({
        supportFeedback: {
          markedSelfService: true,
          timestamp: new Date(),
        },
      });

      console.log(`Lead ${leadId} marked as self-service by Support Team`);

      return { success: true };
    }

    // For reroute requests, verify lead was classified as support or duplicate
    if (currentClassification !== 'support' && currentClassification !== 'duplicate') {
      return { success: false, error: 'Feedback is only available for support or duplicate classifications' };
    }

    // Check if already rerouted
    if (lead.reroute) {
      return { success: false, error: 'This lead has already been rerouted' };
    }

    const now = new Date();

    // Get the current terminal state before we clear it
    const currentTerminalState = getTerminalState(lead);

    // Create reroute entry (preserves original classification and what was sent)
    const reroute: Reroute = {
      id: crypto.randomUUID(),
      source: source as RerouteSource,
      reason: reason?.trim() || undefined,
      originalClassification: currentClassification,
      previousTerminalState: currentTerminalState || undefined,
      timestamp: now,
    };

    // Build the note prefix based on source
    const sourceLabels: Record<string, string> = {
      customer: 'Customer Reroute',
      support: 'Support Team Reroute',
      sales: 'Sales Team Reroute',
    };
    const sourceLabel = sourceLabels[source];
    const noteContent = reason?.trim()
      ? `[${sourceLabel}] ${reason}`
      : `[${sourceLabel}] No additional context provided`;

    // Customer feedback goes to review, internal feedback goes to classify
    const newStatus = source === 'customer' ? 'review' : 'classify';

    // Update lead with reroute and clear terminal state (acts like never sent)
    await adminDb.collection('leads').doc(leadId).update({
      reroute,
      'status.status': newStatus,
      'status.sent_at': null,
      'status.sent_by': null,
      edit_note: noteContent,
    });

    console.log(`Lead ${leadId} rerouted by ${source}. Original classification: ${currentClassification}`);

    return { success: true };
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return { success: false, error: 'Failed to submit feedback' };
  }
}

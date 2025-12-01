import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendEmailParams {
  to: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  actualRecipient: string;
  testMode: boolean;
}

/**
 * Send an email via Resend
 *
 * In test mode (testModeEmail provided), all emails are sent to the test address
 * and the subject is prefixed with [TEST].
 *
 * Note: Resend requires verified domains for "from" addresses.
 * For testing, use onboarding@resend.dev or verify your domain.
 */
export async function sendEmail(
  params: SendEmailParams,
  testModeEmail?: string | null
): Promise<SendEmailResult> {
  const isTestMode = !!testModeEmail;
  const actualRecipient = testModeEmail || params.to;

  // In test mode, prefix subject and add original recipient info to body
  const subject = isTestMode
    ? `[TEST] ${params.subject}`
    : params.subject;

  const html = isTestMode
    ? `<p style="color: #666; font-style: italic;">[Test Mode - Original recipient: ${params.to}]</p>${params.html}`
    : params.html;

  // Use Resend's test domain until a custom domain is verified
  const fromAddress = `${params.fromName} <onboarding@resend.dev>`;

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: actualRecipient,
      subject,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      return {
        success: false,
        error: error.message,
        actualRecipient,
        testMode: isTestMode,
      };
    }

    console.log(`Email sent successfully. ID: ${data?.id}, To: ${actualRecipient}, TestMode: ${isTestMode}`);

    return {
      success: true,
      messageId: data?.id,
      actualRecipient,
      testMode: isTestMode,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to send email:', errorMessage);

    return {
      success: false,
      error: errorMessage,
      actualRecipient,
      testMode: isTestMode,
    };
  }
}

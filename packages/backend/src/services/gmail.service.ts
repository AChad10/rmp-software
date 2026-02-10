import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import { buildEmailTemplate } from '../templates/emailFooter';

const gmail = google.gmail('v1');

interface EmailRecipients {
  to: string;
  cc?: string[];
  bcc?: string[];
}

interface CreateDraftParams {
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  pdfPath: string;
  pdfFilename?: string;
}

interface GmailDraftResult {
  draftId: string;
  draftUrl: string;
}

/**
 * Get Gmail OAuth2 client
 */
function getGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'http://localhost' // Redirect URI (not used for refresh token flow)
  );

  // Set refresh token
  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN
  });

  return oauth2Client;
}

/**
 * Create a MIME message with PDF attachment
 */
async function createMimeMessage(params: CreateDraftParams): Promise<string> {
  const { to, cc, bcc, subject, body, pdfPath, pdfFilename } = params;

  // Read PDF file
  const pdfContent = await fs.readFile(pdfPath);
  const pdfBase64 = pdfContent.toString('base64');
  const filename = pdfFilename || path.basename(pdfPath);

  // Build email headers
  const headers = [
    `To: ${to}`,
    cc && cc.length > 0 ? `Cc: ${cc.join(', ')}` : null,
    bcc && bcc.length > 0 ? `Bcc: ${bcc.join(', ')}` : null,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="boundary_mixed"'
  ].filter(Boolean).join('\r\n');

  // Build MIME message
  const mimeMessage = [
    headers,
    '',
    '--boundary_mixed',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
    '',
    '--boundary_mixed',
    'Content-Type: application/pdf',
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${filename}"`,
    '',
    pdfBase64,
    '',
    '--boundary_mixed--'
  ].join('\r\n');

  // Encode message in base64url format
  return Buffer.from(mimeMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Create Gmail draft with PDF attachment
 */
export async function createSalaryDraft(params: CreateDraftParams): Promise<GmailDraftResult> {
  try {
    const auth = getGmailClient();

    // Create MIME message
    const encodedMessage = await createMimeMessage(params);

    // Create draft
    const response = await gmail.users.drafts.create({
      auth,
      userId: 'me',
      requestBody: {
        message: {
          raw: encodedMessage
        }
      }
    });

    const draftId = response.data.id!;
    const draftUrl = `https://mail.google.com/mail/u/0/#drafts/${draftId}`;

    console.log(`✅ Gmail draft created: ${draftId}`);
    console.log(`   To: ${params.to}`);
    if (params.cc && params.cc.length > 0) {
      console.log(`   Cc: ${params.cc.join(', ')}`);
    }
    if (params.bcc && params.bcc.length > 0) {
      console.log(`   Bcc: ${params.bcc.join(', ')}`);
    }

    return {
      draftId,
      draftUrl
    };

  } catch (error: any) {
    console.error('❌ Failed to create Gmail draft:', error.message);

    if (error.code === 401) {
      throw new Error('Gmail authentication failed. Please check GMAIL_* environment variables.');
    }

    if (error.code === 403) {
      throw new Error('Gmail API quota exceeded or permission denied.');
    }

    throw new Error(`Gmail API error: ${error.message}`);
  }
}

/**
 * Build salary email body HTML (simplified)
 */
export function buildSalaryEmailBody(params: {
  trainerName: string;
  month: string;
}): string {
  const { trainerName, month } = params;

  return buildEmailTemplate({
    greeting: `Dear ${trainerName},`,
    body: `<p style="margin: 15px 0; font-size: 14px;">Please find attached your salary statement for the month of <strong>${month}</strong>.</p>`,
    includeAutoMessage: true
  });
}

/**
 * Get default salary email recipients
 */
export function getDefaultRecipients(): { cc: string[]; bcc: string[] } {
  return {
    cc: [
      process.env.DIRECTOR_EMAIL || 'director@redmatpilates.com',
      process.env.FOUNDING_TRAINER_EMAIL || 'foundingtrainer@redmatpilates.com'
    ],
    bcc: [
      process.env.ACCOUNTANT_EMAIL || 'accountant@redmatpilates.com'
    ]
  };
}

/**
 * Verify Gmail credentials are configured
 */
export function verifyGmailConfig(): { configured: boolean; missing: string[] } {
  const required = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'];
  const missing = required.filter(key => !process.env[key]);

  return {
    configured: missing.length === 0,
    missing
  };
}

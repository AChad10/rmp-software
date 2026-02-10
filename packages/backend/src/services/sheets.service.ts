import { google } from 'googleapis';
import type { JWT } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import { buildEmailTemplate } from '../templates/emailFooter';

/**
 * Check which env vars are present for Google service account auth.
 */
export function verifyServiceAccountConfig(): { configured: boolean; missing: string[] } {
  const required = ['GOOGLE_SERVICE_ACCOUNT_KEY', 'GOOGLE_DELEGATED_USER'];
  const missing = required.filter((k) => !process.env[k]);
  return { configured: missing.length === 0, missing };
}

/**
 * Build a GoogleAuth JWT client using the service-account key.
 * Supports either an inline JSON string or a file path.
 */
export function getServiceAccountAuth(scopes: string[]): JWT {
  const keyEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  const delegatedUser = process.env.GOOGLE_DELEGATED_USER || '';

  let credentials: { client_email: string; private_key: string };

  if (keyEnv.trim().startsWith('{')) {
    // Inline JSON string
    credentials = JSON.parse(keyEnv);
  } else {
    // File path - resolve relative to backend directory
    const keyPath = path.isAbsolute(keyEnv)
      ? keyEnv
      : path.resolve(process.cwd(), keyEnv);

    const keyContent = fs.readFileSync(keyPath, 'utf-8');
    credentials = JSON.parse(keyContent);
  }

  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes,
    subject: delegatedUser,
  });
}

/**
 * Export the first sheet of a Google Spreadsheet as a PDF buffer.
 */
export async function exportSheetAsPdf(spreadsheetId: string): Promise<Buffer> {
  const auth = getServiceAccountAuth([
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
  ]);

  const drive = google.drive({ version: 'v3', auth });

  const response = await drive.files.export(
    {
      fileId: spreadsheetId,
      mimeType: 'application/pdf',
    },
    { responseType: 'arraybuffer' },
  );

  return Buffer.from(response.data as ArrayBuffer);
}

/**
 * Create a Gmail draft with a PDF attachment, impersonating the delegated user.
 */
export async function createTrainerLogsDraft(params: {
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
}): Promise<{ draftId: string; draftUrl: string }> {
  const auth = getServiceAccountAuth([
    'https://www.googleapis.com/auth/gmail.compose',
  ]);

  const gmail = google.gmail({ version: 'v1', auth });

  const boundary = '===BOUNDARY===';
  const delegatedUser = process.env.GOOGLE_DELEGATED_USER || '';

  const headers = [
    `From: ${delegatedUser}`,
    `To: ${params.to}`,
    params.cc && params.cc.length > 0 ? `Cc: ${params.cc.join(', ')}` : null,
    params.bcc && params.bcc.length > 0 ? `Bcc: ${params.bcc.join(', ')}` : null,
    `Subject: ${params.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter(Boolean).join('\r\n');

  const messageParts = [
    headers,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    params.body,
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${params.pdfFilename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${params.pdfFilename}"`,
    '',
    params.pdfBuffer.toString('base64'),
    `--${boundary}--`,
  ];

  const rawMessage = messageParts.join('\r\n');
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const draft = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: { raw: encodedMessage },
    },
  });

  const draftId = draft.data.id || '';
  const draftUrl = `https://mail.google.com/mail/u/2/#drafts?compose=${draftId}`;

  return { draftId, draftUrl };
}

/**
 * Create a Gmail draft with a PDF attachment from a file path.
 * Uses service account with domain-wide delegation.
 */
export async function createDraftWithPdfFile(params: {
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  pdfPath: string;
  pdfFilename?: string;
}): Promise<{ draftId: string; draftUrl: string }> {
  const auth = getServiceAccountAuth([
    'https://www.googleapis.com/auth/gmail.compose',
  ]);

  const gmail = google.gmail({ version: 'v1', auth });

  const pdfContent = fs.readFileSync(params.pdfPath);
  const filename = params.pdfFilename || path.basename(params.pdfPath);
  const delegatedUser = process.env.GOOGLE_DELEGATED_USER || '';

  const boundary = '===BOUNDARY===';

  const headers = [
    `From: ${delegatedUser}`,
    `To: ${params.to}`,
    params.cc && params.cc.length > 0 ? `Cc: ${params.cc.join(', ')}` : null,
    params.bcc && params.bcc.length > 0 ? `Bcc: ${params.bcc.join(', ')}` : null,
    `Subject: ${params.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter(Boolean).join('\r\n');

  const messageParts = [
    headers,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    params.body,
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${filename}"`,
    '',
    pdfContent.toString('base64'),
    `--${boundary}--`,
  ];

  const rawMessage = messageParts.join('\r\n');
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const draft = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: { raw: encodedMessage },
    },
  });

  const draftId = draft.data.id || '';
  const draftUrl = `https://mail.google.com/mail/u/2/#drafts?compose=${draftId}`;

  return { draftId, draftUrl };
}

import fs from 'fs';
import path from 'path';

/**
 * Get the RMP logo as base64 for inline embedding
 */
export function getLogoBase64(): string {
  try {
    // Logo is at the root of the monorepo (../../logo.jpeg from backend/src/templates/)
    const logoPath = path.resolve(__dirname, '../../../..', 'logo.jpeg');
    const logoBuffer = fs.readFileSync(logoPath);
    return logoBuffer.toString('base64');
  } catch (error) {
    console.warn('Failed to load logo.jpeg from:', path.resolve(__dirname, '../../../..', 'logo.jpeg'));
    console.warn('Error:', error);
    return '';
  }
}

/**
 * Standard email footer for all automated messages
 */
export function getEmailFooter(includeAutoMessage: boolean = true): string {
  const logoBase64 = getLogoBase64();

  return `
    <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e60000; font-family: Arial, sans-serif; color: #333;">
      <p style="margin: 5px 0; font-size: 13px; line-height: 1.4;">--</p>
      <p style="margin: 5px 0; font-size: 13px; line-height: 1.4;"><strong>Thanks &amp; Regards,</strong></p>
      <p style="margin: 5px 0; font-size: 13px; line-height: 1.4;"><strong>Shared Ops</strong></p>
      <br>
      <p style="margin: 5px 0; font-size: 14px; line-height: 1.6;">
        <strong>RedMat Pilates</strong> - <span style="color: #e60000; font-weight: 600;">#MoveBetterFeelBetter</span><br>
        <span style="font-size: 12px; color: #666;">Studios : Xpress (Online) | Gurugram</span><br>
        <a href="https://www.redmatpilates.com" style="color: #e60000; text-decoration: none;">www.redmatpilates.com</a> | <a href="tel:+919205933669" style="color: #333; text-decoration: none;">+91-9205933669</a><br>
        <span style="font-size: 11px; color: #666;">Now unlimited memberships plans starting Rs 100 a day!*</span><br>
        <span style="font-size: 10px; color: #999;">*T&amp;C apply</span>
      </p>
      ${logoBase64 ? `
      <div style="margin-top: 15px;">
        <img src="data:image/jpeg;base64,${logoBase64}" alt="RedMat Pilates" style="max-width: 150px; height: auto;" />
      </div>
      ` : ''}
      ${includeAutoMessage ? `
      <p style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 11px; color: #999; font-style: italic;">
        This is an automated email. Please do not reply to this message.
      </p>
      ` : ''}
    </div>
  `;
}

/**
 * Build simple HTML email template with standard footer
 */
export function buildEmailTemplate(params: {
  greeting: string;
  body: string;
  includeAutoMessage?: boolean;
}): string {
  const { greeting, body, includeAutoMessage = true } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 650px;
      margin: 0 auto;
      padding: 20px;
    }
    .content {
      background: #ffffff;
      padding: 30px;
      border: 1px solid #e0e0e0;
      border-radius: 5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      <p style="margin: 0 0 15px 0; font-size: 14px;">${greeting}</p>
      ${body}
      ${getEmailFooter(includeAutoMessage)}
    </div>
  </div>
</body>
</html>
  `.trim();
}

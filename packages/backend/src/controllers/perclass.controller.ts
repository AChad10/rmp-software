import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Trainer, PerClassStatement, AuditLog } from '../models';
import { ApiResponse, ISessionEntry } from '@rmp/shared-types';
import { readSessionLogs, calculateBillingFromSessions } from '../services/sessionLogs.service';
import {
  verifyServiceAccountConfig,
  createTrainerLogsDraft,
} from '../services/sheets.service';
import { getEmailFooter } from '../templates/emailFooter';

// ---------- helpers ----------

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function formatMonthLabel(month: string): string {
  const [yearStr, monthStr] = month.split('-');
  const monthNum = parseInt(monthStr);
  return `${MONTH_NAMES[monthNum - 1]} ${yearStr}`;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function buildSessionSummaryHtml(statement: any): string {
  const rows = statement.sessionBreakdown.map((entry: any) => {
    if (entry.subTypeBreakdown && entry.subTypeBreakdown.length > 0) {
      return entry.subTypeBreakdown.map((sub: any) => `
        <tr>
          <td>${entry.classType}</td>
          <td>${sub.name}</td>
          <td class="num">${sub.sessions}</td>
          <td class="num">-</td>
          <td class="num">-</td>
        </tr>
      `).join('');
    }
    return `
      <tr>
        <td>${getCategoryLabel(entry.classType)}</td>
        <td>${entry.classType}</td>
        <td class="num">${entry.sessions}</td>
        <td class="num">${entry.sessions - entry.noShowSessions}</td>
        <td class="num">${entry.noShowSessions}</td>
      </tr>
    `;
  }).join('');
  return rows;
}

function buildBillingBreakdownHtml(statement: any): string {
  const rows = statement.sessionBreakdown.map((entry: any) => {
    if (entry.subTypeBreakdown && entry.subTypeBreakdown.length > 0) {
      return entry.subTypeBreakdown.map((sub: any) => `
        <tr>
          <td>${entry.classType} - ${sub.name}</td>
          <td class="num">${sub.sessions}</td>
          <td class="num">${formatCurrency(sub.billingRate)}</td>
          <td class="num">${formatCurrency(sub.totalBilling)}</td>
        </tr>
      `).join('');
    }
    return `
      <tr>
        <td>${entry.classType}</td>
        <td class="num">${entry.sessions}</td>
        <td class="num">${formatCurrency(entry.billingRate)}</td>
        <td class="num">${formatCurrency(entry.totalBilling)}</td>
      </tr>
    `;
  }).join('');
  return rows;
}

function getCategoryLabel(classType: string): string {
  const upper = classType.toUpperCase();
  if (['XPRESS', 'MAT', 'BARRE', 'REFORMER'].includes(upper)) return 'Group';
  if (upper === 'SEMI PRIVATE') return 'Semi Private';
  if (upper === 'PRIVATE') return 'Private';
  if (upper === 'DISCOVERY') return 'Discovery';
  return 'Other';
}

function buildConfirmationPageContent(statement: any, alreadyConfirmed: boolean): string {
  const monthLabel = formatMonthLabel(statement.month);

  if (alreadyConfirmed) {
    const confirmedDate = statement.confirmedAt
      ? new Date(statement.confirmedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    return `
      <div class="already-confirmed">
        <p>You have already confirmed your session logs for ${monthLabel}.</p>
        ${confirmedDate ? `<p class="date">Confirmed on ${confirmedDate}</p>` : ''}
      </div>
    `;
  }

  const billingRows = statement.sessionBreakdown.map((entry: any) => {
    if (entry.subTypeBreakdown && entry.subTypeBreakdown.length > 0) {
      return entry.subTypeBreakdown.map((sub: any) => `
        <tr>
          <td>${entry.classType} - ${sub.name}</td>
          <td class="num">${sub.sessions}</td>
          <td class="num">${formatCurrency(sub.billingRate)}</td>
          <td class="num">${formatCurrency(sub.totalBilling)}</td>
        </tr>
      `).join('');
    }
    return `
      <tr>
        <td>${entry.classType}</td>
        <td class="num">${entry.sessions}</td>
        <td class="num">${formatCurrency(entry.billingRate)}</td>
        <td class="num">${formatCurrency(entry.totalBilling)}</td>
      </tr>
    `;
  }).join('');

  return `
    <h1>Session Log Confirmation</h1>
    <p class="subtitle">${statement.trainerName} - ${monthLabel}</p>

    <table>
      <thead>
        <tr>
          <th>Class Type</th>
          <th class="num">Sessions</th>
          <th class="num">Rate (INR)</th>
          <th class="num">Billing (INR)</th>
        </tr>
      </thead>
      <tbody>
        ${billingRows}
        <tr class="total-row">
          <td>Total</td>
          <td class="num">${statement.totalSessions}</td>
          <td></td>
          <td class="num">${formatCurrency(statement.grossBilling)}</td>
        </tr>
      </tbody>
    </table>

    <p class="gross-label">Gross Billing</p>
    <p class="gross-amount">INR ${formatCurrency(statement.grossBilling)}</p>

    <form method="POST">
      <button type="submit" class="confirm-btn">I confirm my session logs for ${monthLabel}</button>
    </form>
  `;
}

// ---------- controllers ----------

/**
 * Send log summaries for all per-class trainers
 * POST /api/salary/per-class/send-logs
 */
export async function sendLogSummaries(req: Request, res: Response): Promise<void> {
  try {
    const { month } = req.body;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ success: false, error: 'Month is required (format: YYYY-MM)' } as ApiResponse);
      return;
    }

    // Find all active per-class trainers
    const trainers = await Trainer.find({
      status: 'active',
      compensationType: 'per_class',
      'classConfig.sheetId': { $exists: true, $ne: '' },
    });

    if (trainers.length === 0) {
      res.json({
        success: true,
        data: { sent: 0, errors: [] },
        message: 'No active per-class trainers found with sheet configuration',
      } as ApiResponse);
      return;
    }

    const serviceAccountConfig = verifyServiceAccountConfig();
    const results: any[] = [];
    const errors: any[] = [];

    for (const trainer of trainers) {
      try {
        const classConfig = trainer.classConfig;
        if (!classConfig || !classConfig.sheetId || !classConfig.sheetTab) {
          errors.push({ trainerId: trainer._id.toString(), trainerName: trainer.name, error: 'Missing sheet configuration' });
          continue;
        }

        // Check if statement already exists
        const existing = await PerClassStatement.findOne({
          trainerId: trainer._id.toString(),
          month,
        });
        if (existing && existing.status !== 'pending_logs') {
          console.log(`[SKIP] Per-class statement already exists for ${trainer.name} (${month}), status: ${existing.status}`);
          continue;
        }

        // Read session data from Google Sheet
        let sessionData: { entries: ISessionEntry[]; totalSessions: number; grossBilling: number };
        try {
          sessionData = await readSessionLogs({
            sheetId: classConfig.sheetId,
            sheetTab: classConfig.sheetTab,
            month,
            classTypes: classConfig.classTypes,
          });
        } catch (sheetErr: any) {
          console.warn(`[WARN] Could not read sheet for ${trainer.name}: ${sheetErr.message}`);
          // Fall back to empty data -- admin can update manually
          const entries: ISessionEntry[] = classConfig.classTypes.map(ct => ({
            classType: ct.name,
            sessions: 0,
            noShowSessions: 0,
            billingRate: ct.billingRate,
            totalBilling: 0,
            subTypeBreakdown: ct.subTypes?.map(st => ({
              name: st.name,
              sessions: 0,
              billingRate: st.billingRate,
              totalBilling: 0,
            })),
          }));
          sessionData = { entries, totalSessions: 0, grossBilling: 0 };
        }

        const tdsRate = classConfig.tdsRate || 0.10;
        const tds = Math.round(sessionData.grossBilling * tdsRate);
        const netPayout = sessionData.grossBilling - tds;

        // Create or update PerClassStatement
        let statement;
        if (existing) {
          existing.sessionBreakdown = sessionData.entries;
          existing.totalSessions = sessionData.totalSessions;
          existing.grossBilling = sessionData.grossBilling;
          existing.tds = tds;
          existing.netPayout = netPayout;
          existing.status = 'logs_sent';
          await existing.save();
          statement = existing;
        } else {
          statement = new PerClassStatement({
            trainerId: trainer._id.toString(),
            trainerName: trainer.name,
            month,
            sessionBreakdown: sessionData.entries,
            totalSessions: sessionData.totalSessions,
            grossBilling: sessionData.grossBilling,
            tds,
            netPayout,
            status: 'logs_sent',
            createdBy: req.user?.userId,
          });
          await statement.save();
        }

        // Create Gmail draft with log summary if Gmail is configured
        if (serviceAccountConfig.configured) {
          try {
            const monthLabel = formatMonthLabel(month);
            const templatePath = path.join(__dirname, '../templates/trainerLogsSummary.html');
            let emailHtml = fs.readFileSync(templatePath, 'utf-8');

            const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
            const confirmationUrl = `${backendUrl}/api/salary/per-class/confirm/${statement.confirmationToken}`;

            emailHtml = emailHtml
              .replace(/\{\{TRAINER_NAME\}\}/g, trainer.name)
              .replace(/\{\{MONTH\}\}/g, monthLabel)
              .replace(/\{\{SESSION_SUMMARY_HTML\}\}/g, buildSessionSummaryHtml(statement))
              .replace(/\{\{BILLING_BREAKDOWN_HTML\}\}/g, buildBillingBreakdownHtml(statement))
              .replace(/\{\{TOTAL_SESSIONS\}\}/g, String(statement.totalSessions))
              .replace(/\{\{GROSS_BILLING\}\}/g, formatCurrency(statement.grossBilling))
              .replace(/\{\{CONFIRMATION_URL\}\}/g, confirmationUrl)
              .replace(/\{\{EMAIL_FOOTER\}\}/g, getEmailFooter(true))
              .replace(/\{\{#SHEET_URL\}\}[\s\S]*?\{\{\/SHEET_URL\}\}/g,
                classConfig.sheetId
                  ? `<p style="font-size: 13px;"><a href="https://docs.google.com/spreadsheets/d/${classConfig.sheetId}" style="color: #dc2626; text-decoration: none;">View detailed session logs</a></p>`
                  : ''
              );

            // Create a dummy PDF buffer (log summary email does not need a PDF attachment)
            // Use createTrainerLogsDraft with an empty PDF for now
            const emptyPdf = Buffer.from('');

            // Use Gmail API to create draft without attachment
            const { google } = await import('googleapis');
            const { getServiceAccountAuth } = await import('../services/sheets.service');
            const auth = getServiceAccountAuth(['https://www.googleapis.com/auth/gmail.compose']);
            const gmail = google.gmail({ version: 'v1', auth });
            const delegatedUser = process.env.GOOGLE_DELEGATED_USER || '';
            const directorEmail = process.env.DIRECTOR_EMAIL || '';
            const accountantEmail = process.env.ACCOUNTANT_EMAIL || '';

            const headers = [
              `From: ${delegatedUser}`,
              `To: ${trainer.email}`,
              directorEmail ? `Cc: ${directorEmail}` : null,
              accountantEmail ? `Bcc: ${accountantEmail}` : null,
              `Subject: Session Log Summary - ${monthLabel} - ${trainer.name}`,
              `MIME-Version: 1.0`,
              `Content-Type: text/html; charset="UTF-8"`,
            ].filter(Boolean).join('\r\n');

            const rawMessage = `${headers}\r\n\r\n${emailHtml}`;
            const encodedMessage = Buffer.from(rawMessage)
              .toString('base64')
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=+$/, '');

            const draft = await gmail.users.drafts.create({
              userId: 'me',
              requestBody: { message: { raw: encodedMessage } },
            });

            const draftId = draft.data.id || '';
            const draftUrl = `https://mail.google.com/mail/u/2/#drafts?compose=${draftId}`;

            statement.logsDraftId = draftId;
            statement.logsDraftUrl = draftUrl;
            await statement.save();

            console.log(`[OK] Log summary draft created for ${trainer.name}: ${draftUrl}`);
          } catch (gmailErr: any) {
            console.error(`[WARN] Gmail draft failed for ${trainer.name}:`, gmailErr.message);
            // Statement is still created, just without Gmail draft
          }
        }

        results.push({
          trainerId: trainer._id.toString(),
          trainerName: trainer.name,
          statementId: statement._id.toString(),
          totalSessions: statement.totalSessions,
          grossBilling: statement.grossBilling,
        });

      } catch (err: any) {
        console.error(`[ERROR] Failed to process ${trainer.name}:`, err.message);
        errors.push({ trainerId: trainer._id.toString(), trainerName: trainer.name, error: err.message });
      }
    }

    // Audit log
    await AuditLog.create({
      userId: req.user?.userId || 'system',
      userName: req.user?.email || 'system',
      action: 'send_per_class_logs',
      entity: 'per_class_statement',
      entityId: month,
      metadata: { month, sent: results.length, errors: errors.length },
      timestamp: new Date(),
    });

    res.json({
      success: true,
      data: { sent: results.length, results, errors },
      message: `Sent log summaries for ${results.length} per-class trainers`,
    } as ApiResponse);

  } catch (error: any) {
    console.error('Error sending log summaries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send log summaries',
      ...(process.env.NODE_ENV === 'development' && { message: error.message }),
    } as ApiResponse);
  }
}

/**
 * Show confirmation page (public)
 * GET /api/salary/per-class/confirm/:token
 */
export async function showConfirmationPage(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.params;

    const statement = await PerClassStatement.findOne({ confirmationToken: token });

    const templatePath = path.join(__dirname, '../templates/trainerConfirmation.html');
    let pageHtml = fs.readFileSync(templatePath, 'utf-8');

    if (!statement) {
      const content = `
        <div class="error-box">
          <p>Invalid or expired confirmation link.</p>
        </div>
      `;
      pageHtml = pageHtml
        .replace('{{MONTH}}', '')
        .replace('{{CONTENT}}', content);
      res.status(404).send(pageHtml);
      return;
    }

    const monthLabel = formatMonthLabel(statement.month);
    const alreadyConfirmed = statement.status === 'confirmed' || statement.status === 'payout_sent' || statement.status === 'paid';
    const content = buildConfirmationPageContent(statement, alreadyConfirmed);

    pageHtml = pageHtml
      .replace('{{MONTH}}', monthLabel)
      .replace('{{CONTENT}}', content);

    res.send(pageHtml);

  } catch (error: any) {
    console.error('Error showing confirmation page:', error);
    res.status(500).send('<html><body><h1>Something went wrong</h1><p>Please try again later.</p></body></html>');
  }
}

/**
 * Confirm session logs (public)
 * POST /api/salary/per-class/confirm/:token
 */
export async function confirmSessionLogs(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.params;

    const statement = await PerClassStatement.findOne({ confirmationToken: token });

    const templatePath = path.join(__dirname, '../templates/trainerConfirmation.html');
    let pageHtml = fs.readFileSync(templatePath, 'utf-8');

    if (!statement) {
      const content = `
        <div class="error-box">
          <p>Invalid or expired confirmation link.</p>
        </div>
      `;
      pageHtml = pageHtml
        .replace('{{MONTH}}', '')
        .replace('{{CONTENT}}', content);
      res.status(404).send(pageHtml);
      return;
    }

    const monthLabel = formatMonthLabel(statement.month);

    // Already confirmed
    if (statement.status === 'confirmed' || statement.status === 'payout_sent' || statement.status === 'paid') {
      const content = buildConfirmationPageContent(statement, true);
      pageHtml = pageHtml
        .replace('{{MONTH}}', monthLabel)
        .replace('{{CONTENT}}', content);
      res.send(pageHtml);
      return;
    }

    // Confirm
    statement.status = 'confirmed';
    statement.confirmedAt = new Date();
    await statement.save();

    const content = `
      <div class="already-confirmed">
        <p>Your session logs for ${monthLabel} have been confirmed.</p>
        <p class="date">Confirmed on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
    `;

    pageHtml = pageHtml
      .replace('{{MONTH}}', monthLabel)
      .replace('{{CONTENT}}', content);

    res.send(pageHtml);

  } catch (error: any) {
    console.error('Error confirming session logs:', error);
    res.status(500).send('<html><body><h1>Something went wrong</h1><p>Please try again later.</p></body></html>');
  }
}

/**
 * Generate payouts for confirmed per-class statements
 * POST /api/salary/per-class/generate-payouts
 */
export async function generatePayouts(req: Request, res: Response): Promise<void> {
  try {
    const { month } = req.body;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ success: false, error: 'Month is required (format: YYYY-MM)' } as ApiResponse);
      return;
    }

    // Find confirmed statements for this month
    const statements = await PerClassStatement.find({ month, status: 'confirmed' });

    if (statements.length === 0) {
      res.json({
        success: true,
        data: { generated: 0, errors: [] },
        message: 'No confirmed statements found for this month',
      } as ApiResponse);
      return;
    }

    const serviceAccountConfig = verifyServiceAccountConfig();
    const results: any[] = [];
    const errors: any[] = [];

    for (const statement of statements) {
      try {
        const trainer = await Trainer.findById(statement.trainerId);
        if (!trainer) {
          errors.push({ statementId: statement._id.toString(), error: 'Trainer not found' });
          continue;
        }

        // Create payment advice email draft
        if (serviceAccountConfig.configured) {
          try {
            const monthLabel = formatMonthLabel(month);
            const templatePath = path.join(__dirname, '../templates/trainerPaymentAdvice.html');
            let emailHtml = fs.readFileSync(templatePath, 'utf-8');

            const tdsRate = trainer.classConfig?.tdsRate || 0.10;
            const tdsPercent = `${(tdsRate * 100).toFixed(0)}%`;

            emailHtml = emailHtml
              .replace(/\{\{TRAINER_NAME\}\}/g, trainer.name)
              .replace(/\{\{MONTH\}\}/g, monthLabel)
              .replace(/\{\{BILLING_BREAKDOWN_HTML\}\}/g, buildBillingBreakdownHtml(statement))
              .replace(/\{\{GROSS_BILLING\}\}/g, formatCurrency(statement.grossBilling))
              .replace(/\{\{TDS_RATE\}\}/g, tdsPercent)
              .replace(/\{\{TDS_AMOUNT\}\}/g, formatCurrency(statement.tds))
              .replace(/\{\{NET_PAYOUT\}\}/g, formatCurrency(statement.netPayout))
              .replace(/\{\{EMAIL_FOOTER\}\}/g, getEmailFooter(true));

            const { google } = await import('googleapis');
            const { getServiceAccountAuth } = await import('../services/sheets.service');
            const auth = getServiceAccountAuth(['https://www.googleapis.com/auth/gmail.compose']);
            const gmail = google.gmail({ version: 'v1', auth });
            const delegatedUser = process.env.GOOGLE_DELEGATED_USER || '';
            const directorEmail = process.env.DIRECTOR_EMAIL || '';
            const accountantEmail = process.env.ACCOUNTANT_EMAIL || '';

            const headers = [
              `From: ${delegatedUser}`,
              `To: ${trainer.email}`,
              directorEmail ? `Cc: ${directorEmail}` : null,
              accountantEmail ? `Bcc: ${accountantEmail}` : null,
              `Subject: Payment Advice - ${monthLabel} - ${trainer.name}`,
              `MIME-Version: 1.0`,
              `Content-Type: text/html; charset="UTF-8"`,
            ].filter(Boolean).join('\r\n');

            const rawMessage = `${headers}\r\n\r\n${emailHtml}`;
            const encodedMessage = Buffer.from(rawMessage)
              .toString('base64')
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=+$/, '');

            const draft = await gmail.users.drafts.create({
              userId: 'me',
              requestBody: { message: { raw: encodedMessage } },
            });

            const draftId = draft.data.id || '';
            const draftUrl = `https://mail.google.com/mail/u/2/#drafts?compose=${draftId}`;

            statement.payoutDraftId = draftId;
            statement.payoutDraftUrl = draftUrl;

            console.log(`[OK] Payment advice draft created for ${statement.trainerName}: ${draftUrl}`);
          } catch (gmailErr: any) {
            console.error(`[WARN] Gmail payout draft failed for ${statement.trainerName}:`, gmailErr.message);
          }
        }

        statement.status = 'payout_sent';
        await statement.save();

        results.push({
          statementId: statement._id.toString(),
          trainerName: statement.trainerName,
          grossBilling: statement.grossBilling,
          tds: statement.tds,
          netPayout: statement.netPayout,
        });

      } catch (err: any) {
        console.error(`[ERROR] Failed to generate payout for ${statement.trainerName}:`, err.message);
        errors.push({ statementId: statement._id.toString(), trainerName: statement.trainerName, error: err.message });
      }
    }

    // Audit log
    await AuditLog.create({
      userId: req.user?.userId || 'system',
      userName: req.user?.email || 'system',
      action: 'generate_per_class_payouts',
      entity: 'per_class_statement',
      entityId: month,
      metadata: { month, generated: results.length, errors: errors.length },
      timestamp: new Date(),
    });

    res.json({
      success: true,
      data: { generated: results.length, results, errors },
      message: `Generated payouts for ${results.length} per-class trainers`,
    } as ApiResponse);

  } catch (error: any) {
    console.error('Error generating payouts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate payouts',
      ...(process.env.NODE_ENV === 'development' && { message: error.message }),
    } as ApiResponse);
  }
}

/**
 * Get per-class statements
 * GET /api/salary/per-class/statements
 */
export async function getPerClassStatements(req: Request, res: Response): Promise<void> {
  try {
    const { month, status } = req.query;
    const filter: any = {};

    if (month && typeof month === 'string') filter.month = month;
    if (status && typeof status === 'string') filter.status = status;

    const statements = await PerClassStatement.find(filter).sort({ trainerName: 1 });

    res.json({
      success: true,
      data: statements,
    } as ApiResponse);

  } catch (error: any) {
    console.error('Error fetching per-class statements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch per-class statements',
      ...(process.env.NODE_ENV === 'development' && { message: error.message }),
    } as ApiResponse);
  }
}

/**
 * Update per-class statement status
 * PUT /api/salary/per-class/statements/:id/status
 */
export async function updatePerClassStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending_logs', 'logs_sent', 'confirmed', 'payout_sent', 'paid'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      } as ApiResponse);
      return;
    }

    const statement = await PerClassStatement.findById(id);
    if (!statement) {
      res.status(404).json({ success: false, error: 'Statement not found' } as ApiResponse);
      return;
    }

    const oldStatus = statement.status;
    statement.status = status;

    if (status === 'confirmed' && !statement.confirmedAt) {
      statement.confirmedAt = new Date();
    }

    await statement.save();

    await AuditLog.create({
      userId: req.user?.userId || 'system',
      userName: req.user?.email || 'system',
      action: 'update_per_class_status',
      entity: 'per_class_statement',
      entityId: statement._id.toString(),
      changes: { before: oldStatus, after: status },
      timestamp: new Date(),
    });

    res.json({
      success: true,
      data: statement,
      message: `Status updated to ${status}`,
    } as ApiResponse);

  } catch (error: any) {
    console.error('Error updating per-class statement status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update status',
      ...(process.env.NODE_ENV === 'development' && { message: error.message }),
    } as ApiResponse);
  }
}

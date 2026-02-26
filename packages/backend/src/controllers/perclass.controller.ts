import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Trainer, PerClassStatement, AuditLog } from '../models';
import { ApiResponse } from '@rmp/shared-types';
import { duplicateMonthColumn, exportTrainerTabAsPdf } from '../services/hrSheet.service';
import {
  verifyServiceAccountConfig,
  createTrainerLogsDraft,
} from '../services/sheets.service';
import { buildEmailTemplate } from '../templates/emailFooter';

// ---------- helpers ----------

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function formatMonthLabel(month: string): string {
  const [yearStr, monthStr] = month.split('-');
  const monthNum = parseInt(monthStr);
  return `${MONTH_NAMES[monthNum - 1]} ${yearStr}`;
}

// ---------- controllers ----------

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

    let content: string;
    if (alreadyConfirmed) {
      const confirmedDate = statement.confirmedAt
        ? new Date(statement.confirmedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';
      content = `
        <div class="already-confirmed">
          <p>You have already confirmed your session logs for ${monthLabel}.</p>
          ${confirmedDate ? `<p class="date">Confirmed on ${confirmedDate}</p>` : ''}
        </div>
      `;
    } else {
      content = `
        <h1>Session Log Confirmation</h1>
        <p class="subtitle">${statement.trainerName} - ${monthLabel}</p>
        <p>Please confirm that your session logs for ${monthLabel} are correct.</p>
        <form method="POST">
          <button type="submit" class="confirm-btn">I confirm my session logs for ${monthLabel}</button>
        </form>
      `;
    }

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

    if (statement.status === 'confirmed' || statement.status === 'payout_sent' || statement.status === 'paid') {
      const confirmedDate = statement.confirmedAt
        ? new Date(statement.confirmedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';
      const content = `
        <div class="already-confirmed">
          <p>You have already confirmed your session logs for ${monthLabel}.</p>
          ${confirmedDate ? `<p class="date">Confirmed on ${confirmedDate}</p>` : ''}
        </div>
      `;
      pageHtml = pageHtml
        .replace('{{MONTH}}', monthLabel)
        .replace('{{CONTENT}}', content);
      res.send(pageHtml);
      return;
    }

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

        // 1. Duplicate the rightmost column with new month
        const { newColumnLetter } = await duplicateMonthColumn({
          trainerName: trainer.name,
          newMonth: month,
        });

        // 2. Export the trainer's tab as PDF
        const pdfBuffer = await exportTrainerTabAsPdf(trainer.name);
        const monthLabel = formatMonthLabel(month);
        const pdfFilename = `Payment_Advice_${trainer.name.replace(/\s+/g, '_')}_${monthLabel.replace(/\s+/g, '_')}.pdf`;

        // 3. Create Gmail draft with PDF attachment
        if (serviceAccountConfig.configured) {
          try {
            const emailBody = buildEmailTemplate({
              greeting: `Dear ${trainer.name},`,
              body: `<p style="margin: 15px 0; font-size: 14px;">Please find attached your payment advice for <strong>${monthLabel}</strong>.</p>`,
              includeAutoMessage: true,
            });

            const directorEmail = process.env.DIRECTOR_EMAIL || '';
            const accountantEmail = process.env.ACCOUNTANT_EMAIL || '';

            const { draftId, draftUrl } = await createTrainerLogsDraft({
              to: trainer.email,
              cc: directorEmail ? [directorEmail] : [],
              bcc: accountantEmail ? [accountantEmail] : [],
              subject: `Payment Advice - ${monthLabel} - ${trainer.name}`,
              body: emailBody,
              pdfBuffer,
              pdfFilename,
            });

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
          newColumn: newColumnLetter,
        });

      } catch (err: any) {
        console.error(`[ERROR] Failed to generate payout for ${statement.trainerName}:`, err.message);
        errors.push({ statementId: statement._id.toString(), trainerName: statement.trainerName, error: err.message });
      }
    }

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

    const validStatuses = ['logs_sent', 'confirmed', 'payout_sent', 'paid'];
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

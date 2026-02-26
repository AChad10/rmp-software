import { Request, Response } from 'express';
import { Trainer } from '../models/Trainer';
import { PerClassStatement } from '../models/PerClassStatement';
import { AuditLog } from '../models/AuditLog';
import {
  verifyServiceAccountConfig,
  exportSheetAsPdf,
  createTrainerLogsDraft,
} from '../services/sheets.service';
import { buildEmailTemplate } from '../templates/emailFooter';
import type { TrainerLogsDraftResult } from '@rmp/shared-types';

/**
 * Extract the spreadsheet ID from a Google Sheets URL.
 */
function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * POST /api/trainer-logs/create-drafts
 *
 * For each active trainer with a trainerLogsUrl, export the sheet as PDF
 * and create a Gmail draft addressed to the trainer.
 * For per-class trainers, also embed a confirmation link and create a PerClassStatement.
 */
export async function createAllDrafts(req: Request, res: Response): Promise<void> {
  try {
    const check = verifyServiceAccountConfig();
    if (!check.configured) {
      res.status(400).json({
        success: false,
        error: `Google service account not configured. Missing: ${check.missing.join(', ')}`,
      });
      return;
    }

    const trainers = await Trainer.find({ team: 'trainer', status: 'active' }).lean();

    const now = new Date();
    const monthLabel = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const foundingTrainerEmail = process.env.FOUNDING_TRAINER_EMAIL || 'foundingtrainer@redmatpilates.com';
    const opsManagerEmail = process.env.OPS_MANAGER_EMAIL || 'ops@redmatpilates.com';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

    const results: TrainerLogsDraftResult[] = [];

    for (const trainer of trainers) {
      if (!trainer.trainerLogsUrl) {
        results.push({
          trainerId: trainer._id.toString(),
          trainerName: trainer.name,
          status: 'skipped',
          error: 'No trainerLogsUrl configured',
        });
        continue;
      }

      const spreadsheetId = extractSpreadsheetId(trainer.trainerLogsUrl);
      if (!spreadsheetId) {
        results.push({
          trainerId: trainer._id.toString(),
          trainerName: trainer.name,
          status: 'failed',
          error: 'Could not extract spreadsheet ID from URL',
        });
        continue;
      }

      try {
        // For per-class trainers, create/find the PerClassStatement first (need the token for the email)
        let statement: any = null;
        let confirmationSection = '';

        if (trainer.compensationType === 'per_class') {
          statement = await PerClassStatement.findOne({
            trainerId: trainer._id.toString(),
            month,
          });

          if (!statement) {
            statement = new PerClassStatement({
              trainerId: trainer._id.toString(),
              trainerName: trainer.name,
              month,
              status: 'logs_sent',
              createdBy: req.user?.userId,
            });
            await statement.save();
          } else if (statement.status === 'logs_sent') {
            // Re-sending, that's fine
          } else {
            // Already confirmed or further along, skip
            results.push({
              trainerId: trainer._id.toString(),
              trainerName: trainer.name,
              status: 'skipped',
              error: `Statement already ${statement.status}`,
            });
            continue;
          }

          const confirmationUrl = `${backendUrl}/api/salary/per-class/confirm/${statement.confirmationToken}`;
          confirmationSection = `<p style="margin: 15px 0; font-size: 14px;">Please review your logs carefully. Once reviewed, please confirm by clicking the button below:</p>
            <p style="margin: 15px 0;"><a href="${confirmationUrl}" style="background-color: #dc2626; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">Confirm Session Logs</a></p>`;
        }

        const pdfBuffer = await exportSheetAsPdf(spreadsheetId);
        const pdfFilename = `Trainer_Logs_${trainer.name.replace(/\s+/g, '_')}_${monthLabel.replace(/\s+/g, '_')}.pdf`;

        const emailBody = buildEmailTemplate({
          greeting: `Dear ${trainer.name},`,
          body: `<p style="margin: 15px 0; font-size: 14px;">Please find attached your trainer logs for the month of <strong>${monthLabel}</strong>.</p>${confirmationSection}`,
          includeAutoMessage: true,
        });

        const { draftId, draftUrl } = await createTrainerLogsDraft({
          to: trainer.email,
          cc: [foundingTrainerEmail, opsManagerEmail],
          subject: `${trainer.name} Trainer Logs - ${monthLabel}`,
          body: emailBody,
          pdfBuffer,
          pdfFilename,
        });

        // For per-class trainers, save the draft info on the statement
        if (statement) {
          statement.logsDraftId = draftId;
          statement.logsDraftUrl = draftUrl;
          await statement.save();
        }

        results.push({
          trainerId: trainer._id.toString(),
          trainerName: trainer.name,
          status: 'success',
          draftId,
          draftUrl,
        });
      } catch (err) {
        results.push({
          trainerId: trainer._id.toString(),
          trainerName: trainer.name,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    await AuditLog.create({
      userId: req.user?.userId || 'system',
      userName: req.user?.email || 'system',
      action: 'create_trainer_logs_drafts',
      entity: 'trainer_logs',
      entityId: 'batch',
      metadata: {
        totalTrainers: trainers.length,
        success: results.filter((r) => r.status === 'success').length,
        failed: results.filter((r) => r.status === 'failed').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
      },
      timestamp: new Date(),
    });

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error creating trainer logs drafts:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create drafts',
    });
  }
}

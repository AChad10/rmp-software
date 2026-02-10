import { Request, Response } from 'express';
import { Trainer } from '../models/Trainer';
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
 * e.g. https://docs.google.com/spreadsheets/d/ABC123/edit → ABC123
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

    // Email recipients configuration
    const foundingTrainerEmail = process.env.FOUNDING_TRAINER_EMAIL || 'foundingtrainer@redmatpilates.com';
    const opsManagerEmail = process.env.OPS_MANAGER_EMAIL || 'ops@redmatpilates.com';

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
        const pdfBuffer = await exportSheetAsPdf(spreadsheetId);
        const pdfFilename = `Trainer_Logs_${trainer.name.replace(/\s+/g, '_')}_${monthLabel.replace(/\s+/g, '_')}.pdf`;

        const emailBody = buildEmailTemplate({
          greeting: `Dear ${trainer.name},`,
          body: `<p style="margin: 15px 0; font-size: 14px;">Please find attached your trainer logs for the month of <strong>${monthLabel}</strong>.</p>`,
          includeAutoMessage: true
        });

        const { draftId, draftUrl } = await createTrainerLogsDraft({
          to: trainer.email,
          cc: [foundingTrainerEmail, opsManagerEmail],
          subject: `${trainer.name} Trainer Logs - ${monthLabel}`,
          body: emailBody,
          pdfBuffer,
          pdfFilename,
        });

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

    // Create audit log entry
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

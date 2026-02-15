import { Request, Response } from 'express';
import fs from 'fs/promises';
import { Trainer, SalaryStatement, AuditLog } from '../models';
import { GenerateSalaryRequest, ApiResponse } from '@rmp/shared-types';
import { calculateSalary, generateAllSalaries, salaryStatementExists, getBonusQuarter } from '../services/salary.service';
import {
  generateSalaryPDF,
  pdfExists,
  SalaryPDFData,
  getDaysInMonth,
  getFinancialYear,
  getPeriodString,
  getMilestoneNote
} from '../services/pdf.service';
import { buildSalaryEmailBody } from '../services/gmail.service';
import {
  verifyServiceAccountConfig,
  createDraftWithPdfFile,
} from '../services/sheets.service';

/**
 * Generate salary statements (manual trigger)
 * POST /api/salary/generate
 */
export async function generateSalaryStatements(req: Request, res: Response): Promise<void> {
  try {
    const request: GenerateSalaryRequest = req.body;

    if (!request.month) {
      res.status(400).json({
        success: false,
        error: 'Month is required (format: YYYY-MM)'
      } as ApiResponse);
      return;
    }

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(request.month)) {
      res.status(400).json({
        success: false,
        error: 'Invalid month format. Use YYYY-MM'
      } as ApiResponse);
      return;
    }

    console.log(`\n[START] Salary generation initiated by ${req.user?.email || 'unknown'}`);

    // Calculate salaries
    const result = await generateAllSalaries(request);

    // Generate PDFs and create database records
    const statements = [];
    const pdfErrors = [];

    for (const breakdown of result.generated) {
      try {
        // Check if statement already exists
        const exists = await salaryStatementExists(breakdown.trainerId, breakdown.month);
        if (exists) {
          console.log(`[SKIP] Skipping ${breakdown.trainerName} - statement already exists`);
          continue;
        }

        // Get trainer for member ID
        const trainer = await Trainer.findById(breakdown.trainerId);
        if (!trainer) {
          throw new Error('Trainer not found');
        }

        // Build PDF data
        const annualBase = trainer.baseSalary * 12;
        const monthlyBonus = Math.round(trainer.quarterlyBonusAmount / 12);
        const bonusQuarter = getBonusQuarter(breakdown.month);
        const isBonusMonth = breakdown.calculatedBonus > 0;

        // Determine bonus remarks
        const hasBSC = trainer.quarterlyBonusAmount > 0;
        let bonusRemarks: string;
        if (!hasBSC) {
          bonusRemarks = 'No variable component';
        } else if (isBonusMonth) {
          bonusRemarks = `BSC Score: ${(breakdown.bscScore * 10).toFixed(1)}/10`;
        } else if (bonusQuarter && !isBonusMonth) {
          bonusRemarks = `BSC awaited for ${bonusQuarter.label}`;
        } else {
          bonusRemarks = '*Eff 1st Oct 25, PLR follows quarterly payout cycle.';
        }

        const pdfData: SalaryPDFData = {
          // Employee Info
          employeeName: breakdown.trainerName,
          designation: trainer.designation || 'Instructor',
          employeeCode: trainer.employeeCode,
          panNumber: trainer.panNumber || '',

          // Period Info
          period: getPeriodString(breakdown.year, breakdown.monthNumber),
          daysInPeriod: getDaysInMonth(breakdown.year, breakdown.monthNumber),
          financialYear: getFinancialYear(breakdown.year, breakdown.monthNumber),
          month: breakdown.month,

          // Fixed Compensation
          annualBase,
          monthlyBase: trainer.baseSalary,
          currentBase: trainer.baseSalary,
          baseRemarks: '',

          // Variable Compensation
          annualBonus: trainer.quarterlyBonusAmount,
          monthlyBonus,
          currentBonus: isBonusMonth ? String(Math.round(breakdown.calculatedBonus)) : '',
          bonusRemarks,

          // Totals
          annualCTC: trainer.annualCTC || (annualBase + trainer.quarterlyBonusAmount),
          monthlyCTC: trainer.baseSalary + monthlyBonus,

          // Other
          travelRemarks: `On actuals as per policy, Claims awaited for ${getPeriodString(breakdown.year, breakdown.monthNumber)}`,
          bankTransfer: breakdown.totalSalary,
          milestoneNote: getMilestoneNote(trainer.joinDate)
        };

        // Generate PDF
        const { pdfPath, pdfUrl } = await generateSalaryPDF(pdfData);

        // Create salary statement record
        const statement = new SalaryStatement({
          trainerId: breakdown.trainerId,
          trainerName: breakdown.trainerName,
          month: breakdown.month,
          year: breakdown.year,
          monthNumber: breakdown.monthNumber,
          baseSalary: breakdown.baseSalary,
          quarterlyBonusAmount: breakdown.quarterlyBonusAmount,
          bscScore: breakdown.bscScore,
          calculatedBonus: breakdown.calculatedBonus,
          totalSalary: breakdown.totalSalary,
          bscEntryId: breakdown.bscEntryId,
          pdfPath,
          pdfUrl,
          status: 'draft',
          createdBy: req.user?.userId
        });

        await statement.save();

        // Skip automatic Gmail draft creation - will be done separately
        console.log(`[INFO] PDF generated for ${breakdown.trainerName}. Use "Create Drafts" to generate Gmail drafts.`);

        statements.push(statement);

        // Create audit log
        await AuditLog.create({
          userId: req.user?.userId || 'system',
          userName: req.user?.email || 'system',
          action: 'generate',
          entity: 'salary_statement',
          entityId: statement._id.toString(),
          metadata: {
            month: breakdown.month,
            totalSalary: breakdown.totalSalary
          },
          timestamp: new Date()
        });

      } catch (error: any) {
        console.error(`[ERROR] PDF generation failed for ${breakdown.trainerName}:`, error.message);
        pdfErrors.push({
          trainerId: breakdown.trainerId,
          trainerName: breakdown.trainerName,
          error: error.message
        });
      }
    }

    res.json({
      success: result.success && pdfErrors.length === 0,
      data: {
        month: request.month,
        totalCalculated: result.generated.length,
        statementsCreated: statements.length,
        calculationErrors: result.errors,
        pdfErrors
      },
      message: `Generated ${statements.length} salary statements for ${request.month}`
    } as ApiResponse);

  } catch (error: any) {
    console.error('Error generating salary statements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate salary statements',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    } as ApiResponse);
  }
}

/**
 * Get salary statements with filters
 * GET /api/salary/statements
 */
export async function getSalaryStatements(req: Request, res: Response): Promise<void> {
  try {
    const { month, trainerId, status } = req.query;

    const filter: any = {};

    if (month && typeof month === 'string') {
      filter.month = month;
    }

    if (trainerId && typeof trainerId === 'string') {
      filter.trainerId = trainerId;
    }

    if (status && typeof status === 'string') {
      filter.status = status;
    }

    const statements = await SalaryStatement.find(filter)
      .sort({ year: -1, monthNumber: -1, trainerName: 1 });

    res.json({
      success: true,
      data: statements
    } as ApiResponse);

  } catch (error: any) {
    console.error('Error fetching salary statements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch salary statements',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    } as ApiResponse);
  }
}

/**
 * Get single salary statement by ID
 * GET /api/salary/statements/:id
 */
export async function getSalaryStatementById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const statement = await SalaryStatement.findById(id);

    if (!statement) {
      res.status(404).json({
        success: false,
        error: 'Salary statement not found'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: statement
    } as ApiResponse);

  } catch (error: any) {
    console.error('Error fetching salary statement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch salary statement',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    } as ApiResponse);
  }
}

/**
 * Update salary statement status
 * PUT /api/salary/statements/:id/status
 */
export async function updateStatementStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['draft', 'sent', 'paid'].includes(status)) {
      res.status(400).json({
        success: false,
        error: 'Invalid status. Must be: draft, sent, or paid'
      } as ApiResponse);
      return;
    }

    const statement = await SalaryStatement.findById(id);

    if (!statement) {
      res.status(404).json({
        success: false,
        error: 'Salary statement not found'
      } as ApiResponse);
      return;
    }

    const oldStatus = statement.status;
    statement.status = status;

    if (status === 'sent' && !statement.sentAt) {
      statement.sentAt = new Date();
    }

    if (status === 'paid' && !statement.paidAt) {
      statement.paidAt = new Date();
    }

    await statement.save();

    // Create audit log
    await AuditLog.create({
      userId: req.user?.userId || 'system',
      userName: req.user?.email || 'system',
      action: 'update_status',
      entity: 'salary_statement',
      entityId: statement._id.toString(),
      changes: {
        before: oldStatus,
        after: status
      },
      timestamp: new Date()
    });

    res.json({
      success: true,
      data: statement,
      message: `Status updated to ${status}`
    } as ApiResponse);

  } catch (error: any) {
    console.error('Error updating statement status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update statement status',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    } as ApiResponse);
  }
}

/**
 * Create Gmail drafts for salary statements with PDFs
 * POST /api/salary/create-drafts
 */
export async function createGmailDrafts(req: Request, res: Response): Promise<void> {
  try {
    const { month } = req.body;

    if (!month) {
      res.status(400).json({
        success: false,
        error: 'Month is required (format: YYYY-MM)'
      } as ApiResponse);
      return;
    }

    // Verify Gmail API is configured
    const serviceAccountConfig = verifyServiceAccountConfig();
    if (!serviceAccountConfig.configured) {
      res.status(400).json({
        success: false,
        error: `Gmail API not configured. Missing: ${serviceAccountConfig.missing.join(', ')}`,
        message: 'Please configure Gmail service account credentials'
      } as ApiResponse);
      return;
    }

    console.log(`\n[START] Creating Gmail drafts for ${month}`);

    // Find all statements for this month that have PDFs but no Gmail drafts
    const statements = await SalaryStatement.find({
      month,
      pdfPath: { $exists: true, $ne: null },
      gmailDraftId: { $exists: false }
    });

    if (statements.length === 0) {
      res.json({
        success: true,
        data: {
          month,
          totalProcessed: 0,
          draftsCreated: 0,
          errors: []
        },
        message: 'No statements found that need draft creation'
      } as ApiResponse);
      return;
    }

    const results = [];
    const errors = [];

    // Email recipients configuration
    const directorEmail = process.env.DIRECTOR_EMAIL || 'director@redmatpilates.com';
    const foundingTrainerEmail = process.env.FOUNDING_TRAINER_EMAIL || 'foundingtrainer@redmatpilates.com';
    const accountantEmail = process.env.ACCOUNTANT_EMAIL || 'accountant@redmatpilates.com';

    for (const statement of statements) {
      try {
        // Fetch trainer to get their email
        const trainer = await Trainer.findById(statement.trainerId);
        if (!trainer) {
          errors.push({
            trainerId: statement.trainerId,
            trainerName: statement.trainerName,
            error: 'Trainer not found'
          });
          continue;
        }

        const emailBody = buildSalaryEmailBody({
          trainerName: statement.trainerName,
          month: statement.month
        });

        const gmailResult = await createDraftWithPdfFile({
          to: trainer.email,
          cc: [directorEmail, foundingTrainerEmail],
          bcc: [accountantEmail],
          subject: `Salary Statement - ${statement.month}`,
          body: emailBody,
          pdfPath: statement.pdfPath!,
        });

        // Update statement with Gmail info
        statement.gmailDraftId = gmailResult.draftId;
        statement.gmailDraftUrl = gmailResult.draftUrl;
        await statement.save();

        results.push({
          trainerId: statement.trainerId,
          trainerName: statement.trainerName,
          draftId: gmailResult.draftId,
          draftUrl: gmailResult.draftUrl
        });

        console.log(`✅ Draft created for ${statement.trainerName}: ${gmailResult.draftUrl}`);

      } catch (error: any) {
        console.error(`❌ Failed to create draft for ${statement.trainerName}:`, error.message);
        errors.push({
          trainerId: statement.trainerId,
          trainerName: statement.trainerName,
          error: error.message
        });
      }
    }

    console.log(`\n[DONE] Created ${results.length} drafts, ${errors.length} errors`);

    res.json({
      success: errors.length === 0,
      data: {
        month,
        totalProcessed: statements.length,
        draftsCreated: results.length,
        drafts: results,
        errors
      },
      message: `Created ${results.length} Gmail drafts for ${month}`
    } as ApiResponse);

  } catch (error: any) {
    console.error('Error creating Gmail drafts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create Gmail drafts',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    } as ApiResponse);
  }
}

/**
 * Download/preview salary statement PDF
 * GET /api/salary/statements/:id/pdf
 */
export async function downloadStatementPdf(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const statement = await SalaryStatement.findById(id);

    if (!statement || !statement.pdfPath) {
      res.status(404).json({ success: false, error: 'PDF not found' } as ApiResponse);
      return;
    }

    const exists = await pdfExists(statement.pdfPath);
    if (!exists) {
      res.status(404).json({ success: false, error: 'PDF file missing from server' } as ApiResponse);
      return;
    }

    const pdfBuffer = await fs.readFile(statement.pdfPath);
    const filename = statement.pdfPath.split('/').pop() || 'salary-statement.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('Error downloading PDF:', error);
    res.status(500).json({ success: false, error: 'Failed to download PDF' } as ApiResponse);
  }
}

import { Request, Response } from 'express';
import { Trainer, SalaryStatement, AuditLog } from '../models';
import { GenerateSalaryRequest, ApiResponse } from '@rmp/shared-types';
import { calculateSalary, generateAllSalaries, salaryStatementExists } from '../services/salary.service';
import { generateSalaryPDF } from '../services/pdf.service';
import {
  createSalaryDraft,
  buildSalaryEmailBody,
  getDefaultRecipients,
  verifyGmailConfig
} from '../services/gmail.service';

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

    console.log(`\n🚀 Salary generation initiated by ${req.user?.email || 'unknown'}`);

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
          console.log(`⏭️  Skipping ${breakdown.trainerName} - statement already exists`);
          continue;
        }

        // Get trainer for member ID
        const trainer = await Trainer.findById(breakdown.trainerId);
        if (!trainer) {
          throw new Error('Trainer not found');
        }

        // Generate PDF
        const { pdfPath, pdfUrl } = await generateSalaryPDF({
          trainerName: breakdown.trainerName,
          memberId: trainer.memberId,
          month: breakdown.month,
          year: breakdown.year,
          monthNumber: breakdown.monthNumber,
          baseSalary: breakdown.baseSalary,
          quarterlyBonusAmount: breakdown.quarterlyBonusAmount,
          bscScore: breakdown.bscScore,
          calculatedBonus: breakdown.calculatedBonus,
          totalSalary: breakdown.totalSalary,
          bscApplied: breakdown.calculatedBonus > 0
        });

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

        // Create Gmail draft (if Gmail is configured)
        const gmailConfig = verifyGmailConfig();
        if (gmailConfig.configured && trainer.email) {
          try {
            const emailBody = buildSalaryEmailBody({
              trainerName: breakdown.trainerName,
              month: breakdown.month,
              totalSalary: breakdown.totalSalary
            });

            const recipients = getDefaultRecipients();

            const gmailResult = await createSalaryDraft({
              to: trainer.email,
              cc: recipients.cc,
              bcc: recipients.bcc,
              subject: `Salary Statement - ${breakdown.month}`,
              body: emailBody,
              pdfPath
            });

            // Update statement with Gmail info
            statement.gmailDraftId = gmailResult.draftId;
            statement.gmailDraftUrl = gmailResult.draftUrl;
            await statement.save();

          } catch (gmailError: any) {
            console.warn(`⚠️  Gmail draft creation failed for ${breakdown.trainerName}: ${gmailError.message}`);
            // Don't fail the whole process if Gmail fails
          }
        } else if (!gmailConfig.configured) {
          console.log(`⏭️  Skipping Gmail draft - not configured (missing: ${gmailConfig.missing.join(', ')})`);
        } else if (!trainer.email) {
          console.log(`⚠️  Skipping Gmail draft for ${breakdown.trainerName} - no email address`);
        }

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
        console.error(`❌ PDF generation failed for ${breakdown.trainerName}:`, error.message);
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
      message: error.message
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
      message: error.message
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
      message: error.message
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
      message: error.message
    } as ApiResponse);
  }
}

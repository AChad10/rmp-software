import { Request, Response } from 'express';
import fs from 'fs/promises';
import { Trainer, SalaryStatement, AuditLog } from '../models';
import { GenerateSalaryRequest, ApiResponse } from '@rmp/shared-types';
import { calculateSalary, generateAllSalaries, salaryStatementExists, getBonusQuarter } from '../services/salary.service';
import {
  generateSalaryPDF,
  generateSeniorSalaryPDF,
  deleteSalaryPDF,
  pdfExists,
  SalaryPDFData,
  SeniorSalaryPDFData,
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
        const existingStatement = await SalaryStatement.findOne({
          trainerId: breakdown.trainerId,
          month: breakdown.month,
        });
        if (existingStatement && !request.overwrite) {
          console.log(`[SKIP] Skipping ${breakdown.trainerName} - statement already exists (use overwrite to regenerate)`);
          continue;
        }
        if (existingStatement) {
          // Delete old PDF file
          try {
            if (existingStatement.pdfPath) {
              await deleteSalaryPDF(existingStatement.pdfPath);
            }
          } catch (e) {
            console.warn(`[WARN] Could not delete old PDF for ${breakdown.trainerName}`);
          }
          // Delete old statement
          await SalaryStatement.deleteOne({ _id: existingStatement._id });
          console.log(`[OVERWRITE] Deleted existing statement for ${breakdown.trainerName}`);
        }

        // Get trainer for member ID
        const trainer = await Trainer.findById(breakdown.trainerId);
        if (!trainer) {
          throw new Error('Trainer not found');
        }

        // Determine compensation type and generate appropriate PDF
        const compensationType = trainer.compensationType || 'standard';
        const bonusQuarter = getBonusQuarter(breakdown.month);
        const isBonusMonth = breakdown.calculatedBonus > 0;

        let pdfPath: string;
        let pdfUrl: string;
        let customBreakdown: any;

        if (compensationType === 'per_class') {
          // Skip per-class trainers -- they have their own workflow
          console.log(`[SKIP] Skipping ${breakdown.trainerName} - per_class trainer (use per-class workflow)`);
          continue;
        }

        if (compensationType === 'senior' && trainer.salaryComponents) {
          // Senior: use custom components template
          const fixedComponents = trainer.salaryComponents.fixed.map(c => ({
            name: c.name,
            annualAmount: c.annualAmount,
            monthlyAmount: c.monthlyAmount,
            frequency: c.frequency,
            remarks: c.remarks,
            currentAmount: c.monthlyAmount, // Default to monthly; admin can override in preview
          }));

          const variableComponents = trainer.salaryComponents.variable.map(c => ({
            name: c.name,
            annualAmount: c.annualAmount,
            monthlyAmount: c.monthlyAmount,
            frequency: c.frequency,
            remarks: c.remarks,
            currentAmount: isBonusMonth && c.frequency === 'Quarterly'
              ? Math.round(c.annualAmount / 4 * (breakdown.bscScore || 0))
              : (c.frequency === 'Monthly' ? c.monthlyAmount : 0),
          }));

          const totalCurrent = [...fixedComponents, ...variableComponents].reduce((s, c) => s + c.currentAmount, 0);
          const tds = 0; // TDS configurable later
          const bankTransfer = totalCurrent - tds;

          const seniorPdfData: SeniorSalaryPDFData = {
            employeeName: breakdown.trainerName,
            designation: trainer.designation || 'Staff',
            employeeCode: trainer.employeeCode,
            panNumber: trainer.panNumber || '',
            period: getPeriodString(breakdown.year, breakdown.monthNumber),
            daysInPeriod: getDaysInMonth(breakdown.year, breakdown.monthNumber),
            financialYear: getFinancialYear(breakdown.year, breakdown.monthNumber),
            month: breakdown.month,
            fixedComponents,
            variableComponents,
            tds,
            travelReimbursement: 0,
            bankTransfer,
            milestoneNote: getMilestoneNote(trainer.joinDate),
          };

          const seniorResult = await generateSeniorSalaryPDF(seniorPdfData);
          pdfPath = seniorResult.pdfPath;
          pdfUrl = seniorResult.pdfUrl;

          // Store custom breakdown for the statement record
          customBreakdown = {
            fixed: fixedComponents.map(c => ({ ...c, id: '', currentRemarks: c.remarks })),
            variable: variableComponents.map(c => ({ ...c, id: '', currentRemarks: c.remarks })),
            effectiveCompensation: totalCurrent,
            tds,
            travelReimbursement: 0,
          };
        } else {
          // Standard: existing logic
          const annualBase = trainer.baseSalary * 12;
          const monthlyBonus = Math.round(trainer.quarterlyBonusAmount / 12);

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
            employeeName: breakdown.trainerName,
            designation: trainer.designation || 'Instructor',
            employeeCode: trainer.employeeCode,
            panNumber: trainer.panNumber || '',
            period: getPeriodString(breakdown.year, breakdown.monthNumber),
            daysInPeriod: getDaysInMonth(breakdown.year, breakdown.monthNumber),
            financialYear: getFinancialYear(breakdown.year, breakdown.monthNumber),
            month: breakdown.month,
            annualBase,
            monthlyBase: trainer.baseSalary,
            currentBase: trainer.baseSalary,
            baseRemarks: '',
            annualBonus: trainer.quarterlyBonusAmount,
            monthlyBonus,
            currentBonus: isBonusMonth ? String(Math.round(breakdown.calculatedBonus)) : '',
            bonusRemarks,
            annualCTC: trainer.annualCTC || (annualBase + trainer.quarterlyBonusAmount),
            monthlyCTC: trainer.baseSalary + monthlyBonus,
            travelRemarks: `On actuals as per policy, Claims awaited for ${getPeriodString(breakdown.year, breakdown.monthNumber)}`,
            bankTransfer: breakdown.totalSalary,
            milestoneNote: getMilestoneNote(trainer.joinDate),
          };

          const standardResult = await generateSalaryPDF(pdfData);
          pdfPath = standardResult.pdfPath;
          pdfUrl = standardResult.pdfUrl;
        }

        // Create salary statement record
        const statement = new SalaryStatement({
          trainerId: breakdown.trainerId,
          trainerName: breakdown.trainerName,
          month: breakdown.month,
          year: breakdown.year,
          monthNumber: breakdown.monthNumber,
          compensationType,
          baseSalary: breakdown.baseSalary,
          quarterlyBonusAmount: breakdown.quarterlyBonusAmount,
          bscScore: breakdown.bscScore,
          calculatedBonus: breakdown.calculatedBonus,
          totalSalary: breakdown.totalSalary,
          bscEntryId: breakdown.bscEntryId,
          customBreakdown,
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

/**
 * Generate a single salary statement with provided PDF data overrides
 * POST /api/salary/generate-single
 */
export async function generateSingleStatement(req: Request, res: Response): Promise<void> {
  try {
    const { trainerId, month, pdfData, overwrite } = req.body;

    if (!trainerId || !month || !pdfData) {
      res.status(400).json({
        success: false,
        error: 'trainerId, month, and pdfData are required',
      } as ApiResponse);
      return;
    }

    const trainer = await Trainer.findById(trainerId);
    if (!trainer) {
      res.status(404).json({ success: false, error: 'Trainer not found' } as ApiResponse);
      return;
    }

    // Handle existing statement
    const existingStatement = await SalaryStatement.findOne({ trainerId, month });
    if (existingStatement) {
      if (!overwrite) {
        res.status(409).json({
          success: false,
          error: 'Statement already exists. Set overwrite: true to regenerate.',
        } as ApiResponse);
        return;
      }
      try {
        if (existingStatement.pdfPath) await deleteSalaryPDF(existingStatement.pdfPath);
      } catch (_) { /* ignore missing file */ }
      await SalaryStatement.deleteOne({ _id: existingStatement._id });
    }

    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr);
    const monthNumber = parseInt(monthStr);

    const singleCompensationType = pdfData.compensationType || trainer.compensationType || 'standard';
    let pdfPath: string;
    let pdfUrl: string;
    let customBreakdown: any;

    if (singleCompensationType === 'senior' && pdfData.fixedComponents) {
      // Senior type: use senior PDF template with dynamic components
      const seniorPdfData: SeniorSalaryPDFData = {
        employeeName: pdfData.employeeName || trainer.name,
        designation: pdfData.designation || trainer.designation || 'Staff',
        employeeCode: pdfData.employeeCode || trainer.employeeCode,
        panNumber: pdfData.panNumber || trainer.panNumber || '',
        period: pdfData.period || getPeriodString(year, monthNumber),
        daysInPeriod: pdfData.daysInPeriod || getDaysInMonth(year, monthNumber),
        financialYear: pdfData.financialYear || getFinancialYear(year, monthNumber),
        month,
        fixedComponents: pdfData.fixedComponents,
        variableComponents: pdfData.variableComponents || [],
        tds: pdfData.tds || 0,
        travelReimbursement: pdfData.travelReimbursement || 0,
        bankTransfer: pdfData.bankTransfer,
        milestoneNote: getMilestoneNote(trainer.joinDate),
        customNotes: pdfData.customNotes || '',
      };

      const seniorResult = await generateSeniorSalaryPDF(seniorPdfData);
      pdfPath = seniorResult.pdfPath;
      pdfUrl = seniorResult.pdfUrl;

      customBreakdown = {
        fixed: pdfData.fixedComponents.map((c: any) => ({ ...c, id: c.id || '', currentRemarks: c.remarks || '' })),
        variable: (pdfData.variableComponents || []).map((c: any) => ({ ...c, id: c.id || '', currentRemarks: c.remarks || '' })),
        effectiveCompensation: [...pdfData.fixedComponents, ...(pdfData.variableComponents || [])].reduce((s: number, c: any) => s + (c.currentAmount || 0), 0),
        tds: pdfData.tds || 0,
        travelReimbursement: pdfData.travelReimbursement || 0,
      };
    } else {
      // Standard type: use standard PDF template
      const salaryPdfData: SalaryPDFData = {
        employeeName: pdfData.employeeName || trainer.name,
        designation: pdfData.designation || trainer.designation,
        employeeCode: pdfData.employeeCode || trainer.employeeCode,
        panNumber: pdfData.panNumber || trainer.panNumber || '',
        period: pdfData.period || getPeriodString(year, monthNumber),
        daysInPeriod: pdfData.daysInPeriod || getDaysInMonth(year, monthNumber),
        financialYear: pdfData.financialYear || getFinancialYear(year, monthNumber),
        month,
        annualBase: pdfData.annualBase,
        monthlyBase: pdfData.monthlyBase,
        currentBase: pdfData.currentBase,
        baseRemarks: pdfData.baseRemarks || '',
        annualBonus: pdfData.annualBonus,
        monthlyBonus: pdfData.monthlyBonus,
        currentBonus: pdfData.currentBonus || '',
        bonusRemarks: pdfData.bonusRemarks || '',
        annualCTC: pdfData.annualCTC,
        monthlyCTC: pdfData.monthlyCTC,
        travelRemarks: pdfData.travelRemarks || '',
        bankTransfer: pdfData.bankTransfer,
        milestoneNote: getMilestoneNote(trainer.joinDate),
      };

      const standardResult = await generateSalaryPDF(salaryPdfData);
      pdfPath = standardResult.pdfPath;
      pdfUrl = standardResult.pdfUrl;
    }

    const statement = new SalaryStatement({
      trainerId,
      trainerName: trainer.name,
      month,
      year,
      monthNumber,
      compensationType: singleCompensationType,
      baseSalary: pdfData.monthlyBase || 0,
      quarterlyBonusAmount: pdfData.annualBonus || 0,
      bscScore: 0,
      calculatedBonus: parseInt(pdfData.currentBonus) || 0,
      totalSalary: pdfData.bankTransfer,
      customBreakdown,
      pdfPath,
      pdfUrl,
      status: 'draft',
      createdBy: req.user?.userId,
    });

    await statement.save();

    await AuditLog.create({
      userId: req.user?.userId || 'system',
      userName: req.user?.email || 'system',
      action: 'generate_single',
      entity: 'salary_statement',
      entityId: statement._id.toString(),
      metadata: { month, trainerId, overwrite: !!overwrite },
      timestamp: new Date(),
    });

    res.json({
      success: true,
      data: statement,
      message: `Generated salary statement for ${trainer.name}`,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Error generating single statement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate statement',
      ...(process.env.NODE_ENV === 'development' && { message: error.message }),
    } as ApiResponse);
  }
}

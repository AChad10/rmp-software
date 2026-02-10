import cron from 'node-cron';
import { generateAllSalaries, getBonusQuarter } from '../services/salary.service';
import { Trainer, SalaryStatement, AuditLog } from '../models';
import {
  generateSalaryPDF,
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
 * Get current month in YYYY-MM format
 */
function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Automated monthly salary generation job
 * Runs on 28th of every month at 9:00 AM
 */
export function initializeSalaryGenerationCron(): void {
  // Cron schedule: '0 9 28 * *' = At 9:00 AM on the 28th of every month
  // For testing: '*/2 * * * *' = Every 2 minutes
  const schedule = process.env.SALARY_CRON_SCHEDULE || '0 9 28 * *';

  console.log(`[CRON] Salary generation cron scheduled: ${schedule}`);

  cron.schedule(schedule, async () => {
    const startTime = Date.now();
    const month = getCurrentMonth();

    console.log('\n' + '='.repeat(70));
    console.log(`[CRON] AUTOMATED SALARY GENERATION - ${month}`);
    console.log(`   Started: ${new Date().toISOString()}`);
    console.log('='.repeat(70) + '\n');

    try {
      // Step 1: Calculate salaries
      console.log('[STEP 1] Calculating salaries...\n');
      const result = await generateAllSalaries({ month });

      if (result.errors.length > 0) {
        console.warn(`[WARN] ${result.errors.length} salary calculation errors:`);
        result.errors.forEach(err => {
          console.warn(`   - ${err.trainerId}: ${err.error}`);
        });
      }

      // Step 2: Generate PDFs and create statements
      console.log('\n[STEP 2] Generating PDFs...\n');

      const statements = [];
      const pdfErrors = [];

      for (const breakdown of result.generated) {
        try {
          // Check if statement already exists
          const existing = await SalaryStatement.findOne({
            trainerId: breakdown.trainerId,
            month: breakdown.month
          });

          if (existing) {
            console.log(`[SKIP] Skipping ${breakdown.trainerName} - statement already exists`);
            continue;
          }

          // Get trainer for full details
          const trainer = await Trainer.findById(breakdown.trainerId);
          if (!trainer) continue;

          // Build PDF data
          const annualBase = trainer.baseSalary * 12;
          const monthlyBonus = Math.round(trainer.quarterlyBonusAmount / 12);
          const bonusQuarter = getBonusQuarter(breakdown.month);
          const isBonusMonth = breakdown.calculatedBonus > 0;

          // Determine bonus remarks
          let bonusRemarks: string;
          if (isBonusMonth) {
            bonusRemarks = `BSC Score: ${(breakdown.bscScore * 10).toFixed(1)}/10`;
          } else if (bonusQuarter && !isBonusMonth) {
            // It's a payout month but no bonus was calculated (BSC not submitted/validated)
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
            milestoneNote: getMilestoneNote(trainer.joinDate)
          };

          // Generate PDF
          const { pdfPath, pdfUrl } = await generateSalaryPDF(pdfData);

          // Create salary statement
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
            createdBy: 'cron-job'
          });

          // Create Gmail draft (using service account)
          const serviceAccountConfig = verifyServiceAccountConfig();
          if (serviceAccountConfig.configured) {
            try {
              // Email recipients configuration
              const directorEmail = process.env.DIRECTOR_EMAIL || 'director@redmatpilates.com';
              const foundingTrainerEmail = process.env.FOUNDING_TRAINER_EMAIL || 'foundingtrainer@redmatpilates.com';
              const accountantEmail = process.env.ACCOUNTANT_EMAIL || 'accountant@redmatpilates.com';

              const emailBody = buildSalaryEmailBody({
                trainerName: breakdown.trainerName,
                month: breakdown.month
              });

              const gmailResult = await createDraftWithPdfFile({
                to: trainer.email,
                cc: [directorEmail, foundingTrainerEmail],
                bcc: [accountantEmail],
                subject: `Salary Statement - ${breakdown.month}`,
                body: emailBody,
                pdfPath,
              });

              statement.gmailDraftId = gmailResult.draftId;
              statement.gmailDraftUrl = gmailResult.draftUrl;

            } catch (gmailError: any) {
              console.warn(`[WARN] Gmail draft failed for ${breakdown.trainerName}: ${gmailError.message}`);
            }
          }

          await statement.save();
          statements.push(statement);

          // Create audit log
          await AuditLog.create({
            userId: 'cron-job',
            userName: 'Automated Cron Job',
            action: 'generate',
            entity: 'salary_statement',
            entityId: statement._id.toString(),
            metadata: {
              month: breakdown.month,
              totalSalary: breakdown.totalSalary,
              automated: true
            },
            timestamp: new Date()
          });

        } catch (error: any) {
          console.error(`[ERROR] Error processing ${breakdown.trainerName}:`, error.message);
          pdfErrors.push({
            trainerId: breakdown.trainerId,
            trainerName: breakdown.trainerName,
            error: error.message
          });
        }
      }

      // Calculate duration
      const duration = Date.now() - startTime;
      const durationMinutes = (duration / 1000 / 60).toFixed(2);

      // Final summary
      console.log('\n' + '='.repeat(70));
      console.log('[SUMMARY]');
      console.log('='.repeat(70));
      console.log(`Statements Created: ${statements.length}`);
      console.log(`Calculation Errors: ${result.errors.length}`);
      console.log(`PDF Errors: ${pdfErrors.length}`);
      console.log(`Duration: ${durationMinutes} minutes`);
      console.log(`Completed: ${new Date().toISOString()}`);
      console.log('='.repeat(70) + '\n');

      // TODO: Send admin notification via Slack (future enhancement)
      // This would notify admin that salary generation completed

    } catch (error) {
      console.error('\n[FATAL] CRITICAL ERROR in salary generation cron:', error);

      // Log critical error
      await AuditLog.create({
        userId: 'cron-job',
        userName: 'Automated Cron Job',
        action: 'error',
        entity: 'cron_job',
        entityId: 'salary-generation',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        },
        timestamp: new Date()
      });

      // TODO: Send critical error notification to admin
    }
  });

  console.log('[OK] Salary generation cron job initialized\n');
}

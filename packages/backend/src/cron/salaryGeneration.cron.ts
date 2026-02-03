import cron from 'node-cron';
import { generateAllSalaries } from '../services/salary.service';
import { Trainer, SalaryStatement, AuditLog } from '../models';
import { generateSalaryPDF } from '../services/pdf.service';
import {
  createSalaryDraft,
  buildSalaryEmailBody,
  getDefaultRecipients,
  verifyGmailConfig
} from '../services/gmail.service';

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

  console.log(`📅 Salary generation cron scheduled: ${schedule}`);

  cron.schedule(schedule, async () => {
    const startTime = Date.now();
    const month = getCurrentMonth();

    console.log('\n' + '='.repeat(70));
    console.log(`🤖 AUTOMATED SALARY GENERATION - ${month}`);
    console.log(`   Started: ${new Date().toISOString()}`);
    console.log('='.repeat(70) + '\n');

    try {
      // Step 1: Calculate salaries
      console.log('📊 Step 1: Calculating salaries...\n');
      const result = await generateAllSalaries({ month });

      if (result.errors.length > 0) {
        console.warn(`⚠️  ${result.errors.length} salary calculation errors:`);
        result.errors.forEach(err => {
          console.warn(`   - ${err.trainerId}: ${err.error}`);
        });
      }

      // Step 2: Generate PDFs and create statements
      console.log('\n📄 Step 2: Generating PDFs...\n');

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
            console.log(`⏭️  Skipping ${breakdown.trainerName} - statement already exists`);
            continue;
          }

          // Get trainer for full details
          const trainer = await Trainer.findById(breakdown.trainerId);
          if (!trainer) continue;

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

          // Create Gmail draft (if configured)
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

              statement.gmailDraftId = gmailResult.draftId;
              statement.gmailDraftUrl = gmailResult.draftUrl;

            } catch (gmailError: any) {
              console.warn(`⚠️  Gmail draft failed for ${breakdown.trainerName}: ${gmailError.message}`);
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
          console.error(`❌ Error processing ${breakdown.trainerName}:`, error.message);
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
      console.log('📊 SUMMARY');
      console.log('='.repeat(70));
      console.log(`✅ Statements Created: ${statements.length}`);
      console.log(`❌ Calculation Errors: ${result.errors.length}`);
      console.log(`❌ PDF Errors: ${pdfErrors.length}`);
      console.log(`⏱️  Duration: ${durationMinutes} minutes`);
      console.log(`📅 Completed: ${new Date().toISOString()}`);
      console.log('='.repeat(70) + '\n');

      // TODO: Send admin notification via Slack (future enhancement)
      // This would notify admin that salary generation completed

    } catch (error) {
      console.error('\n💥 CRITICAL ERROR in salary generation cron:', error);

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

  console.log('✅ Salary generation cron job initialized\n');
}

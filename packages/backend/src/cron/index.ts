import { App } from '@slack/bolt';
import { initializeSalaryGenerationCron } from './salaryGeneration.cron';
import { initializeBSCRemindersCron, setSlackApp } from './bscReminders.cron';

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs(slackApp: App): void {
  console.log('\n' + '='.repeat(70));
  console.log('⏰ INITIALIZING CRON JOBS');
  console.log('='.repeat(70) + '\n');

  // Set Slack app for BSC reminders
  setSlackApp(slackApp);

  // Initialize cron jobs
  initializeSalaryGenerationCron();
  initializeBSCRemindersCron();

  console.log('='.repeat(70));
  console.log('✅ ALL CRON JOBS INITIALIZED');
  console.log('='.repeat(70) + '\n');
}

import cron from 'node-cron';
import { Trainer, BSCEntry } from '../models';
import { App } from '@slack/bolt';

// We'll need access to the Slack app instance for DMs
let slackApp: App | null = null;

export function setSlackApp(app: App): void {
  slackApp = app;
}

/**
 * Get current quarter in YYYY-Q# format
 */
function getCurrentQuarter(): { quarter: string; year: number; quarterNumber: 1 | 2 | 3 | 4 } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  let quarterNumber: 1 | 2 | 3 | 4;
  if (month >= 1 && month <= 3) quarterNumber = 1;
  else if (month >= 4 && month <= 6) quarterNumber = 2;
  else if (month >= 7 && month <= 9) quarterNumber = 3;
  else quarterNumber = 4;

  return {
    quarter: `${year}-Q${quarterNumber}`,
    year,
    quarterNumber
  };
}

/**
 * Automated BSC reminder job
 * Runs on the last day of each quarter (31st of Mar, Jun, Sep, Dec) at 8:00 AM
 */
export function initializeBSCRemindersCron(): void {
  // Cron schedule: '0 8 31 3,6,9,12 *' = At 8:00 AM on 31st of Mar, Jun, Sep, Dec
  // For testing: '*/5 * * * *' = Every 5 minutes
  const schedule = process.env.BSC_CRON_SCHEDULE || '0 8 31 3,6,9,12 *';

  console.log(`📅 BSC reminders cron scheduled: ${schedule}`);

  cron.schedule(schedule, async () => {
    console.log('\n' + '='.repeat(70));
    console.log('🎯 BSC REMINDER - End of Quarter');
    console.log(`   Started: ${new Date().toISOString()}`);
    console.log('='.repeat(70) + '\n');

    try {
      const { quarter } = getCurrentQuarter();

      // Get all active trainers
      const trainers = await Trainer.find({ status: 'active' });

      let remindersSent = 0;
      let errors = 0;

      for (const trainer of trainers) {
        try {
          // Check if trainer already submitted BSC for this quarter
          const existingBSC = await BSCEntry.findOne({
            trainerId: trainer._id.toString(),
            quarter
          });

          if (existingBSC) {
            console.log(`⏭️  ${trainer.name} - BSC already submitted (${existingBSC.status})`);
            continue;
          }

          // Check if trainer has scorecard template configured
          if (!trainer.scorecardTemplate || trainer.scorecardTemplate.length === 0) {
            console.log(`⚠️  ${trainer.name} - No scorecard template configured`);
            continue;
          }

          // Send Slack DM reminder
          if (slackApp && trainer.userId) {
            const bscFormUrl = process.env.BSC_FORM_URL || 'https://bsc.redmatpilates.com';
            const formLink = `${bscFormUrl}/${trainer._id}/${quarter}`;

            await slackApp.client.chat.postMessage({
              channel: trainer.userId,
              text: `🎯 BSC Submission Reminder - ${quarter}`,
              blocks: [
                {
                  type: 'header',
                  text: {
                    type: 'plain_text',
                    text: '🎯 Quarterly BSC Submission',
                    emoji: true
                  }
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `Hi *${trainer.name}*,\n\nToday is the last day of *${quarter}*. Please submit your Balanced Score Card (BSC) self-assessment.`
                  }
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '*Your BSC submission helps determine your quarterly performance bonus.*'
                  }
                },
                {
                  type: 'divider'
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '📝 *Steps to complete:*\n1. Click the button below\n2. Review your Power BI metrics\n3. Rate yourself on each criterion\n4. Submit for admin validation'
                  }
                },
                {
                  type: 'actions',
                  elements: [
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '📊 Submit BSC Now',
                        emoji: true
                      },
                      url: formLink,
                      style: 'primary'
                    }
                  ]
                },
                {
                  type: 'context',
                  elements: [
                    {
                      type: 'mrkdwn',
                      text: '💡 Need help? Contact your supervisor or HR.'
                    }
                  ]
                }
              ]
            });

            console.log(`✅ Reminder sent to ${trainer.name}`);
            remindersSent++;
          } else {
            console.log(`⚠️  ${trainer.name} - No Slack user ID or Slack app not configured`);
          }

        } catch (error: any) {
          console.error(`❌ Error sending reminder to ${trainer.name}:`, error.message);
          errors++;
        }
      }

      console.log('\n' + '='.repeat(70));
      console.log('📊 SUMMARY');
      console.log('='.repeat(70));
      console.log(`✅ Reminders Sent: ${remindersSent}`);
      console.log(`❌ Errors: ${errors}`);
      console.log(`⏭️  Already Submitted: ${trainers.length - remindersSent - errors}`);
      console.log(`📅 Completed: ${new Date().toISOString()}`);
      console.log('='.repeat(70) + '\n');

    } catch (error) {
      console.error('\n💥 CRITICAL ERROR in BSC reminders cron:', error);
    }
  });

  console.log('✅ BSC reminders cron job initialized\n');
}

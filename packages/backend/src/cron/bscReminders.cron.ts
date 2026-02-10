import cron from 'node-cron';
import { Trainer, BSCEntry } from '../models';
import { App } from '@slack/bolt';

// We'll need access to the Slack app instance for DMs
let slackApp: App | null = null;

export function setSlackApp(app: App): void {
  slackApp = app;
}

/**
 * Get the BSC quarter to check based on the current reminder month.
 * Reminders are sent on the 15th of:
 *   February  → check OND (Q4 of previous year)
 *   May       → check JFM (Q1 of current year)
 *   August    → check AMJ (Q2 of current year)
 *   November  → check JAS (Q3 of current year)
 */
function getReminderQuarter(): { quarter: string; label: string } | null {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  switch (month) {
    case 2:  return { quarter: `${year - 1}-Q4`, label: 'OND' };
    case 5:  return { quarter: `${year}-Q1`, label: 'JFM' };
    case 8:  return { quarter: `${year}-Q2`, label: 'AMJ' };
    case 11: return { quarter: `${year}-Q3`, label: 'JAS' };
    default: return null;
  }
}

/**
 * Automated BSC reminder job
 * Runs on the 15th of Feb, May, Aug, Nov at 8:00 AM
 * If a trainer hasn't submitted their BSC by this date, they get a reminder.
 * Bonus payout schedule: OND→March, JFM→June, AMJ→Sept, JAS→Dec
 */
export function initializeBSCRemindersCron(): void {
  // Cron schedule: '0 8 15 2,5,8,11 *' = At 8:00 AM on 15th of Feb, May, Aug, Nov
  const schedule = process.env.BSC_CRON_SCHEDULE || '0 8 15 2,5,8,11 *';

  console.log(`[CRON] BSC reminders cron scheduled: ${schedule}`);

  cron.schedule(schedule, async () => {
    const reminderQuarter = getReminderQuarter();
    if (!reminderQuarter) {
      console.log('[CRON] BSC REMINDER - Not a reminder month, skipping');
      return;
    }

    const { quarter, label } = reminderQuarter;

    console.log('\n' + '='.repeat(70));
    console.log(`[CRON] BSC REMINDER - ${label} (${quarter})`);
    console.log(`   Started: ${new Date().toISOString()}`);
    console.log('='.repeat(70) + '\n');

    try {
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
            console.log(`[SKIP] ${trainer.name} - BSC already submitted (${existingBSC.status})`);
            continue;
          }

          // Skip non-trainers with no scorecard at all
          if (!trainer.useDefaultScorecard && (!trainer.scorecardTemplate || trainer.scorecardTemplate.length === 0)) {
            console.log(`[WARN] ${trainer.name} - No scorecard template configured`);
            continue;
          }

          // Send Slack DM reminder
          if (slackApp && trainer.userId) {
            const bscFormUrl = process.env.BSC_FORM_URL || 'https://bsc.redmatpilates.com';
            const formLink = `${bscFormUrl}/form/${trainer.bscAccessToken}/${quarter}`;

            await slackApp.client.chat.postMessage({
              channel: trainer.userId,
              text: `BSC Submission Reminder - ${label} (${quarter})`,
              blocks: [
                {
                  type: 'header',
                  text: {
                    type: 'plain_text',
                    text: `BSC Submission Reminder - ${label}`,
                  }
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `Hi *${trainer.name}*,\n\nYour Balanced Score Card (BSC) self-assessment for *${label}* (${quarter}) has not been submitted yet. Please complete it as soon as possible to ensure your quarterly bonus is processed on time.`
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
                    text: '*Steps to complete:*\n1. Click the button below\n2. Review your Power BI metrics\n3. Rate yourself on each criterion\n4. Submit for admin validation'
                  }
                },
                {
                  type: 'actions',
                  elements: [
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: 'Submit BSC Now',
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
                      text: 'Need help? Contact your supervisor or HR.'
                    }
                  ]
                }
              ]
            });

            console.log(`[OK] Reminder sent to ${trainer.name}`);
            remindersSent++;
          } else {
            console.log(`[WARN] ${trainer.name} - No Slack user ID or Slack app not configured`);
          }

        } catch (error: any) {
          console.error(`[ERROR] Error sending reminder to ${trainer.name}:`, error.message);
          errors++;
        }
      }

      console.log('\n' + '='.repeat(70));
      console.log('[SUMMARY]');
      console.log('='.repeat(70));
      console.log(`Quarter: ${label} (${quarter})`);
      console.log(`Reminders Sent: ${remindersSent}`);
      console.log(`Errors: ${errors}`);
      console.log(`Already Submitted: ${trainers.length - remindersSent - errors}`);
      console.log(`Completed: ${new Date().toISOString()}`);
      console.log('='.repeat(70) + '\n');

    } catch (error) {
      console.error('\n[FATAL] CRITICAL ERROR in BSC reminders cron:', error);
    }
  });

  console.log('[OK] BSC reminders cron job initialized\n');
}

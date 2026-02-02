import { App } from '@slack/bolt';
import { buildSalarySlipsModal, buildForm16Modal } from '../modals/documents';
import { buildScorecardLogsModal } from '../modals/scorecardLogs';
import { getTrainerDataWithFallback } from '../config/trainers';

export function registerActions(app: App): void {
  // Open Salary Slips Modal
  app.action('open_salary_modal', async ({ ack, body, client }) => {
    await ack();
    try {
      if ('trigger_id' in body) {
        await client.views.open({
          trigger_id: body.trigger_id,
          view: buildSalarySlipsModal(),
        });
      }
    } catch (error) {
      console.error('Error opening salary modal:', error);
    }
  });

  // Open Form 16 Modal
  app.action('open_form16_modal', async ({ ack, body, client }) => {
    await ack();
    try {
      if ('trigger_id' in body) {
        await client.views.open({
          trigger_id: body.trigger_id,
          view: buildForm16Modal(),
        });
      }
    } catch (error) {
      console.error('Error opening Form 16 modal:', error);
    }
  });

  // Open Scorecard & Logs Modal
  app.action('open_scorecard_logs_modal', async ({ ack, body, client }) => {
    await ack();
    try {
      if ('trigger_id' in body && 'user' in body) {
        // Get trainer-specific URLs
        const trainerData = getTrainerDataWithFallback(body.user.id);

        await client.views.open({
          trigger_id: body.trigger_id,
          view: buildScorecardLogsModal({
            balScoreCardUrl: trainerData.balScoreCardUrl,
            trainerLogsUrl: trainerData.trainerLogsUrl,
            paymentAdviceUrl: trainerData.paymentAdviceUrl,
            leaveRecordsUrl: trainerData.leaveRecordsUrl,
          }),
        });
      }
    } catch (error) {
      console.error('Error opening scorecard/logs modal:', error);
    }
  });

  // Coming Soon - WhatsApp Buddy Dashboard
  app.action('coming_soon_whatsapp', async ({ ack, body, client }) => {
    await ack();
    try {
      if ('trigger_id' in body) {
        await client.views.open({
          trigger_id: body.trigger_id,
          view: {
            type: 'modal',
            title: {
              type: 'plain_text',
              text: 'Coming Soon!',
            },
            close: {
              type: 'plain_text',
              text: 'Got it',
            },
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: ':construction: *WhatsApp Buddy Dashboard*\n\nThis feature is currently under development and will be available soon!\n\nYou\'ll be able to:\n• View your WhatsApp client conversations\n• Track client engagement\n• Send automated reminders\n\nStay tuned for updates!',
                },
              },
            ],
          },
        });
      }
    } catch (error) {
      console.error('Error opening coming soon modal:', error);
    }
  });

  // Handle external link buttons (just acknowledge, URL opens automatically)
  app.action('open_fresha', async ({ ack }) => {
    await ack();
  });

  app.action('open_attendance', async ({ ack }) => {
    await ack();
  });

  app.action('open_schedule', async ({ ack }) => {
    await ack();
  });

  app.action('open_powerbi', async ({ ack }) => {
    await ack();
  });

  app.action('open_sheets', async ({ ack }) => {
    await ack();
  });

  app.action('open_referral_form', async ({ ack }) => {
    await ack();
  });

  app.action('open_customers', async ({ ack }) => {
    await ack();
  });

  // Handle download button clicks in modals (acknowledge only, URL opens automatically)
  app.action(/^download_salary_\d+$/, async ({ ack }) => {
    await ack();
  });

  app.action(/^download_form16_\d+$/, async ({ ack }) => {
    await ack();
  });

  // Handle command button clicks
  app.action('cmd_open_attendance', async ({ ack }) => {
    await ack();
  });

  app.action('cmd_open_schedule', async ({ ack }) => {
    await ack();
  });

  app.action('cmd_open_customers', async ({ ack }) => {
    await ack();
  });

  app.action('cmd_open_performance', async ({ ack }) => {
    await ack();
  });

  // Handle scorecard/logs modal button clicks (URL buttons)
  app.action('open_bal_scorecard', async ({ ack }) => {
    await ack();
  });

  app.action('open_trainer_logs', async ({ ack }) => {
    await ack();
  });

  app.action('open_payment_advice', async ({ ack }) => {
    await ack();
  });

  app.action('open_leave_records', async ({ ack }) => {
    await ack();
  });
}

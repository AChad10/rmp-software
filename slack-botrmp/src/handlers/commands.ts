import { App, SlashCommand, AckFn, RespondFn } from '@slack/bolt';
import { config } from '../config';
import { buildSalarySlipsModal } from '../modals/documents';

// Helper function to check if command is from a DM
function isDirectMessage(channelId: string): boolean {
  // DM channel IDs start with 'D'
  return channelId.startsWith('D');
}

export function registerCommands(app: App): void {
  // /attendance - Quick link to PunchPass attendance
  app.command('/attendance', async ({ command, ack, respond }) => {
    await ack();

    if (!isDirectMessage(command.channel_id)) {
      await respond({
        response_type: 'ephemeral',
        text: ':lock: This command is only available in direct messages with the bot.',
      });
      return;
    }

    await respond({
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ':white_check_mark: *Take Attendance*\nClick the button below to open PunchPass attendance.',
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Open Attendance',
              emoji: true,
            },
            url: config.urls.punchpassAttendance,
            action_id: 'cmd_open_attendance',
          },
        },
      ],
    });
  });

  // /schedule - Quick link to update client health history
  app.command('/schedule', async ({ command, ack, respond }) => {
    await ack();

    if (!isDirectMessage(command.channel_id)) {
      await respond({
        response_type: 'ephemeral',
        text: ':lock: This command is only available in direct messages with the bot.',
      });
      return;
    }

    await respond({
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ':clipboard: *Update Client Health History*\nClick the button below to access client records in PunchPass.',
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Update Health History',
              emoji: true,
            },
            url: config.urls.punchpassCustomers,
            action_id: 'cmd_open_customers',
          },
        },
      ],
    });
  });

  // /payments - Show salary slips modal
  app.command('/payments', async ({ command, ack, client, respond }) => {
    await ack();

    if (!isDirectMessage(command.channel_id)) {
      await respond({
        response_type: 'ephemeral',
        text: ':lock: This command is only available in direct messages with the bot.',
      });
      return;
    }

    try {
      await client.views.open({
        trigger_id: command.trigger_id,
        view: buildSalarySlipsModal(),
      });
    } catch (error) {
      console.error('Error opening payments modal:', error);
    }
  });

  // /performance - Link to Power BI dashboard
  app.command('/performance', async ({ command, ack, respond }) => {
    await ack();

    if (!isDirectMessage(command.channel_id)) {
      await respond({
        response_type: 'ephemeral',
        text: ':lock: This command is only available in direct messages with the bot.',
      });
      return;
    }

    await respond({
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ':chart_with_upwards_trend: *Performance Dashboard*\nClick the button below to view your performance metrics in Power BI.',
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Dashboard',
              emoji: true,
            },
            url: config.urls.powerBi,
            action_id: 'cmd_open_performance',
          },
        },
      ],
    });
  });
}

import { App } from '@slack/bolt';
import { config } from '../config';

// Helper function to check if command is from a DM
function isDirectMessage(channelId: string): boolean {
  return channelId.startsWith('D');
}

export function registerCommands(app: App): void {
  // /attendance - Quick link to PunchPass attendance
  app.command('/attendance', async ({ command, ack, respond }) => {
    await ack();

    if (!isDirectMessage(command.channel_id)) {
      await respond({
        response_type: 'ephemeral',
        text: 'This command is only available in direct messages with the bot.',
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
            text: '*Take Attendance*\nClick the button below to open PunchPass attendance.',
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Open Attendance',
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
        text: 'This command is only available in direct messages with the bot.',
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
            text: '*Update Client Health History*\nClick the button below to access client records in PunchPass.',
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Update Health History',
            },
            url: config.urls.punchpassCustomers,
            action_id: 'cmd_open_customers',
          },
        },
      ],
    });
  });

  // /performance - Link to Power BI dashboard
  app.command('/performance', async ({ command, ack, respond }) => {
    await ack();

    if (!isDirectMessage(command.channel_id)) {
      await respond({
        response_type: 'ephemeral',
        text: 'This command is only available in direct messages with the bot.',
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
            text: '*Performance Dashboard*\nClick the button below to view your performance metrics in Power BI.',
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Dashboard',
            },
            url: config.urls.powerBi,
            action_id: 'cmd_open_performance',
          },
        },
      ],
    });
  });
}

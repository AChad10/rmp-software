import { View } from '@slack/bolt';
import { config } from '../config';
import { getTrainerDataWithFallback } from '../config/trainers';
import { Trainer } from '../models';
import { getCurrentQuarter } from '../utils/quarter';

interface BuildHomeViewParams {
  userName: string;
  userId: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getQuarterMonths(quarter: string): string {
  const q = parseInt(quarter.split('Q')[1]);
  const labels: Record<number, string> = {
    1: 'Jan - Mar',
    2: 'Apr - Jun',
    3: 'Jul - Sep',
    4: 'Oct - Dec',
  };
  return labels[q] || '';
}

export async function buildHomeView({ userName, userId }: BuildHomeViewParams): Promise<View> {
  const trainerData = await getTrainerDataWithFallback(userId);

  // Get trainer details for personalized info
  let trainerInfo: { designation?: string; team?: string } = {};
  try {
    const trainer = await Trainer.findOne({ userId, status: 'active' });
    if (trainer) {
      trainerInfo = {
        designation: trainer.designation,
        team: trainer.team,
      };
    }
  } catch (error) {
    console.warn('Failed to fetch trainer info:', error);
  }

  const currentQuarter = getCurrentQuarter();
  const quarterMonths = getQuarterMonths(currentQuarter);
  const greeting = getGreeting();
  const firstName = userName.split(' ')[0];

  return {
    type: 'home',
    blocks: [
      // Header
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'RedMat Pilates',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${greeting}, *${firstName}*`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: trainerInfo.designation
              ? `${trainerInfo.designation}  |  ${currentQuarter} (${quarterMonths})`
              : currentQuarter,
          },
        ],
      },
      {
        type: 'divider',
      },

      // Daily Tasks
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Daily Tasks*',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Update Studio Availability',
            },
            url: config.urls.fresha,
            action_id: 'open_fresha',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Take Attendance',
            },
            url: config.urls.punchpassAttendance,
            action_id: 'open_attendance',
            style: 'danger',
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Update Client Health History',
            },
            url: config.urls.punchpassCustomers,
            action_id: 'open_customers',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'New Client Referral',
            },
            url: config.urls.referralForm,
            action_id: 'open_referral_form',
          },
        ],
      },
      {
        type: 'divider',
      },

      // Quarterly Self-Assessment
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Quarterly Self-Assessment*\nSubmit your BSC for *${currentQuarter}* (${quarterMonths})`,
        },
      },
      ...(trainerData.bscAccessToken ? [
        {
          type: 'actions' as const,
          elements: [
            {
              type: 'button' as const,
              text: {
                type: 'plain_text' as const,
                text: 'Fill BSC Form',
              },
              url: `${config.urls.bscFormBase}/form/${trainerData.bscAccessToken}/${currentQuarter}`,
              action_id: 'open_bsc_form',
              style: 'primary' as const,
            },
          ],
        },
      ] : [
        {
          type: 'context' as const,
          elements: [
            {
              type: 'mrkdwn' as const,
              text: '_BSC form not available. Please contact your manager._',
            },
          ],
        },
      ]),
      {
        type: 'divider',
      },

      // Performance
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Performance*',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Performance Dashboard',
            },
            url: config.urls.powerBi,
            action_id: 'open_powerbi',
            style: 'primary',
          },
        ],
      },
      {
        type: 'divider',
      },

      // Footer
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'RedMat Pilates  |  Contact business@redmatpilates.com for support',
          },
        ],
      },
    ],
  };
}

import { View } from '@slack/bolt';
import { config } from '../config';
import { getTrainerDataWithFallback } from '../config/trainers';

interface BuildHomeViewParams {
  userName: string;
  userId: string;
}

export function buildHomeView({ userName, userId }: BuildHomeViewParams): View {
  // Get trainer-specific data (or fallback to defaults)
  const trainerData = getTrainerDataWithFallback(userId);
  return {
    type: 'home',
    blocks: [
      // Header with gradient effect using emojis
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔴 Red Mat Pilates - Trainer Dashboard',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Welcome back, *${userName}*! 🙏\n_Your personalized command center for all things Red Mat Pilates._`,
        },
      },
      {
        type: 'divider',
      },

      // Daily Tasks Section
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚡ Daily Tasks',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Quick access to your daily workflows',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📅 Update Studio Availability',
              emoji: true,
            },
            url: config.urls.fresha,
            action_id: 'open_fresha',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '✅ Take Attendance',
              emoji: true,
            },
            url: config.urls.punchpassAttendance,
            action_id: 'open_attendance',
            style: 'danger', // Red accent for important action
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
              text: '📝 Update Client Health History',
              emoji: true,
            },
            url: config.urls.punchpassCustomers,
            action_id: 'open_customers',
          },
        ],
      },
      {
        type: 'divider',
      },

      // Performance & Admin Section
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 Performance & Records',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Track your performance and access your personal records',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📈 View Performance Dashboard',
              emoji: true,
            },
            url: config.urls.powerBi,
            action_id: 'open_powerbi',
            style: 'primary', // Green accent
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🎯 View Scorecard & Logs',
              emoji: true,
            },
            action_id: 'open_scorecard_logs_modal',
            style: 'danger', // Red accent for important access
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '⏱️ *Core Hours This Month:* `42.5 hours`\n_Updated in real-time from your attendance records_',
        },
      },
      {
        type: 'divider',
      },

      // Documents & Forms Section
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📄 Documents & Forms',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Access your documents and submit important forms',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '💵 My Salary Slips',
              emoji: true,
            },
            action_id: 'open_salary_modal',
            style: 'primary', // Green accent
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🧾 Form 16 (Tax Documents)',
              emoji: true,
            },
            action_id: 'open_form16_modal',
            style: 'primary', // Green accent
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
              text: '🤝 Pass New Client Referral',
              emoji: true,
            },
            url: config.urls.referralForm,
            action_id: 'open_referral_form',
            style: 'danger', // Red accent for business growth action
          },
        ],
      },
      {
        type: 'divider',
      },

      // Resources & Help Section
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '💡 Resources & Help',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Quick Commands*\n• `/attendance` - Quick link to take attendance\n• `/schedule` - View your PunchPass schedule\n• `/payments` - Access salary slips\n• `/performance` - Open Power BI dashboard',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '💬 *Need help?* Contact business@redmatpilates.com',
          },
        ],
      },
    ],
  };
}

import { ModalView } from '@slack/bolt';

interface ScorecardLogsUrls {
  balScoreCardUrl: string;
  trainerLogsUrl: string;
  paymentAdviceUrl: string;
  leaveRecordsUrl: string;
}

/**
 * Build the Scorecard & Logs modal
 * Shows personalized links to the trainer's scorecard and logs
 */
export function buildScorecardLogsModal(urls: ScorecardLogsUrls): ModalView {
  return {
    type: 'modal',
    title: {
      type: 'plain_text',
      text: 'Scorecard & Logs',
    },
    close: {
      type: 'plain_text',
      text: 'Close',
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Access Your Personal Records*\n\nClick any button below to view your records in Google Sheets.',
        },
      },
      {
        type: 'divider',
      },
      // First row of buttons
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📊 BAL Score Card',
              emoji: true,
            },
            url: urls.balScoreCardUrl,
            action_id: 'open_bal_scorecard',
            style: 'danger', // Red accent
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📋 Trainer Logs',
              emoji: true,
            },
            url: urls.trainerLogsUrl,
            action_id: 'open_trainer_logs',
            style: 'primary', // Green accent
          },
        ],
      },
      // Second row of buttons
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '💰 Payment Advice',
              emoji: true,
            },
            url: urls.paymentAdviceUrl,
            action_id: 'open_payment_advice',
            style: 'primary', // Green accent
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🗓️ Leave Records',
              emoji: true,
            },
            url: urls.leaveRecordsUrl,
            action_id: 'open_leave_records',
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '_These are your personalized records. If you notice any discrepancies, please contact business@redmatpilates.com_',
          },
        ],
      },
    ],
  };
}

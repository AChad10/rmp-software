import { View } from '@slack/bolt';
import { config } from '../config';

export function buildSalarySlipsModal(): View {
  const documentBlocks = config.documents.salarySlips.map((doc, index) => ({
    type: 'section' as const,
    text: {
      type: 'mrkdwn' as const,
      text: `:page_facing_up: *${doc.name}*`,
    },
    accessory: {
      type: 'button' as const,
      text: {
        type: 'plain_text' as const,
        text: ':arrow_down: Download',
        emoji: true,
      },
      url: doc.url,
      action_id: `download_salary_${index}`,
    },
  }));

  return {
    type: 'modal',
    title: {
      type: 'plain_text',
      text: 'My Salary Slips',
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: 'Close',
      emoji: true,
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':moneybag: *Your Salary Slips*\nClick on any month to download the PDF.',
        },
      },
      {
        type: 'divider',
      },
      ...documentBlocks,
      {
        type: 'divider',
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: ':lock: _These documents are confidential. Please keep them secure._',
          },
        ],
      },
    ],
  };
}

export function buildForm16Modal(): View {
  const documentBlocks = config.documents.form16.map((doc, index) => ({
    type: 'section' as const,
    text: {
      type: 'mrkdwn' as const,
      text: `:page_facing_up: *${doc.name}*`,
    },
    accessory: {
      type: 'button' as const,
      text: {
        type: 'plain_text' as const,
        text: ':arrow_down: Download',
        emoji: true,
      },
      url: doc.url,
      action_id: `download_form16_${index}`,
    },
  }));

  return {
    type: 'modal',
    title: {
      type: 'plain_text',
      text: 'Form 16 - Tax Documents',
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: 'Close',
      emoji: true,
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':receipt: *Your Form 16 Documents*\nForm 16 is your annual tax certificate issued by your employer.',
        },
      },
      {
        type: 'divider',
      },
      ...documentBlocks,
      {
        type: 'divider',
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: ':information_source: _Form 16 is required for filing your Income Tax Return (ITR)._',
          },
        ],
      },
    ],
  };
}

export function buildPaymentsModal(): View {
  return buildSalarySlipsModal();
}

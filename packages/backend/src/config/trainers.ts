/**
 * Trainer Configuration
 * Maps Slack user IDs to trainer-specific information and personalized URLs
 */

export interface TrainerData {
  userId: string;
  name: string;
  employeeCode: string;
  balScoreCardUrl: string;
  trainerLogsUrl: string;
  paymentAdviceUrl: string;
  leaveRecordsUrl: string;
}

/**
 * Trainer mappings
 *
 * To add a new trainer:
 * 1. Get their Slack user ID (you can find this in their Slack profile or use the Slack API)
 * 2. Add their member ID
 * 3. Create personalized Google Sheets for: BAL Score Card, Trainer Logs, Payment Advice, Leave Records
 * 4. Add their entry below
 */
export const trainers: Record<string, TrainerData> = {
  // Example trainer - replace with actual data
  // 'U12345678': {
  //   userId: 'U12345678',
  //   name: 'Taiyaba',
  //   employeeCode: 'TRAINER001',
  //   balScoreCardUrl: 'https://docs.google.com/spreadsheets/d/YOUR_BAL_SCORECARD_ID',
  //   trainerLogsUrl: 'https://docs.google.com/spreadsheets/d/YOUR_TRAINER_LOGS_ID',
  //   paymentAdviceUrl: 'https://docs.google.com/spreadsheets/d/YOUR_PAYMENT_ADVICE_ID',
  //   leaveRecordsUrl: 'https://docs.google.com/spreadsheets/d/YOUR_LEAVE_RECORDS_ID',
  // },

  // Add more trainers here...
};

/**
 * Get trainer data by Slack user ID
 * Returns undefined if trainer not found
 */
export function getTrainerData(userId: string): TrainerData | undefined {
  return trainers[userId];
}

/**
 * Default/fallback URLs for trainers not in the config
 * These will be used until admin adds the trainer's personalized URLs
 */
export const defaultTrainerUrls = {
  balScoreCardUrl: 'https://docs.google.com/spreadsheets/d/PLACEHOLDER_BAL_SCORECARD',
  trainerLogsUrl: 'https://docs.google.com/spreadsheets/d/PLACEHOLDER_TRAINER_LOGS',
  paymentAdviceUrl: 'https://docs.google.com/spreadsheets/d/PLACEHOLDER_PAYMENT_ADVICE',
  leaveRecordsUrl: 'https://docs.google.com/spreadsheets/d/PLACEHOLDER_LEAVE_RECORDS',
};

/**
 * Get trainer data with fallback to default URLs
 * NOW QUERIES MONGODB FIRST, then falls back to trainers config
 */
export async function getTrainerDataWithFallback(userId: string): Promise<{
  name: string;
  balScoreCardUrl: string;
  trainerLogsUrl: string;
  paymentAdviceUrl: string;
  leaveRecordsUrl: string;
  bscAccessToken?: string;
}> {
  // Try to import Trainer model and query MongoDB
  try {
    const { Trainer } = await import('../models');
    const trainerDoc = await Trainer.findOne({ userId, status: 'active' });

    if (trainerDoc) {
      return {
        name: trainerDoc.name,
        balScoreCardUrl: trainerDoc.balScoreCardUrl || defaultTrainerUrls.balScoreCardUrl,
        trainerLogsUrl: trainerDoc.trainerLogsUrl || defaultTrainerUrls.trainerLogsUrl,
        paymentAdviceUrl: trainerDoc.paymentAdviceUrl || defaultTrainerUrls.paymentAdviceUrl,
        leaveRecordsUrl: trainerDoc.leaveRecordsUrl || defaultTrainerUrls.leaveRecordsUrl,
        bscAccessToken: trainerDoc.bscAccessToken,
      };
    }
  } catch (error) {
    console.warn('Failed to query MongoDB for trainer, falling back to config:', error);
  }

  // Fallback to trainers config
  const trainer = getTrainerData(userId);

  if (trainer) {
    return {
      name: trainer.name,
      balScoreCardUrl: trainer.balScoreCardUrl,
      trainerLogsUrl: trainer.trainerLogsUrl,
      paymentAdviceUrl: trainer.paymentAdviceUrl,
      leaveRecordsUrl: trainer.leaveRecordsUrl,
    };
  }

  // Final fallback for trainers not in config or DB
  return {
    name: 'Trainer',
    ...defaultTrainerUrls,
  };
}

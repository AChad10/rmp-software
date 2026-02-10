import dotenv from 'dotenv';

dotenv.config();

export const config = {
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN || '',
    appToken: process.env.SLACK_APP_TOKEN || '',
    signingSecret: process.env.SLACK_SIGNING_SECRET || '',
    allowedChannelId: process.env.ALLOWED_CHANNEL_ID || '',
  },
  urls: {
    fresha: process.env.FRESHA_URL || 'https://partners.fresha.com',
    punchpassAttendance: process.env.PUNCHPASS_ATTENDANCE_URL || 'https://app.punchpass.com/hub',
    punchpassCustomers: process.env.PUNCHPASS_CUSTOMERS_URL || 'https://app.punchpass.com/customers',
    powerBi: process.env.POWERBI_DASHBOARD_URL || 'https://app.powerbi.com/dashboard',
    referralForm: process.env.REFERRAL_FORM_URL || 'https://docs.google.com/forms/d/PLACEHOLDER_FORM_ID',
    bscFormBase: process.env.BSC_FORM_URL || 'http://localhost:5174',
  },
};

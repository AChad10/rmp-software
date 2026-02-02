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
  },
  documents: {
    salarySlips: [
      { name: 'January 2025', url: 'https://storage.redmatpilates.com/salary-jan2025.pdf' },
      { name: 'December 2024', url: 'https://storage.redmatpilates.com/salary-dec2024.pdf' },
      { name: 'November 2024', url: 'https://storage.redmatpilates.com/salary-nov2024.pdf' },
      { name: 'October 2024', url: 'https://storage.redmatpilates.com/salary-oct2024.pdf' },
      { name: 'September 2024', url: 'https://storage.redmatpilates.com/salary-sep2024.pdf' },
      { name: 'August 2024', url: 'https://storage.redmatpilates.com/salary-aug2024.pdf' },
    ],
    form16: [
      { name: 'Form 16 - FY 2023-24', url: 'https://storage.redmatpilates.com/form16-fy2023-24.pdf' },
      { name: 'Form 16 - FY 2022-23', url: 'https://storage.redmatpilates.com/form16-fy2022-23.pdf' },
    ],
  },
};

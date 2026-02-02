import { App, LogLevel } from '@slack/bolt';
import { config } from './config';
import { registerCommands } from './handlers/commands';
import { registerActions } from './handlers/actions';
import { registerEvents } from './handlers/events';

// Validate required environment variables
function validateConfig(): void {
  const required = ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'SLACK_SIGNING_SECRET'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error('Please copy .env.example to .env and fill in your Slack credentials.');
    process.exit(1);
  }
}

// Initialize the Slack app
const app = new App({
  token: config.slack.botToken,
  signingSecret: config.slack.signingSecret,
  socketMode: true,
  appToken: config.slack.appToken,
  logLevel: LogLevel.INFO,
});

// Register all handlers
registerCommands(app);
registerActions(app);
registerEvents(app);

// Start the app
async function start(): Promise<void> {
  validateConfig();

  try {
    await app.start();
    console.log('');
    console.log('='.repeat(50));
    console.log('  Red Mat Pilates Trainer Dashboard');
    console.log('  Slack Bot is running!');
    console.log('='.repeat(50));
    console.log('');
    console.log('Available slash commands:');
    console.log('  /attendance  - Quick link to PunchPass attendance');
    console.log('  /schedule    - Quick link to PunchPass schedule');
    console.log('  /payments    - View salary slips');
    console.log('  /performance - Link to Power BI dashboard');
    console.log('');
    console.log('Open the App Home tab in Slack to see the dashboard.');
    console.log('');
  } catch (error) {
    console.error('Failed to start the app:', error);
    process.exit(1);
  }
}

start();

import { App, LogLevel } from '@slack/bolt';
import express from 'express';
import cors from 'cors';
import { config } from './config';
import { registerCommands } from './handlers/commands';
import { registerActions } from './handlers/actions';
import { registerEvents } from './handlers/events';
import { connectDatabase, setupGracefulShutdown } from './config/database';
import authRouter from './routes/auth.routes';
import trainersRouter from './routes/trainers.routes';
import salaryRouter from './routes/salary.routes';
import bscRouter from './routes/bsc.routes';
import { initializeCronJobs } from './cron';
import path from 'path';

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
const slackApp = new App({
  token: config.slack.botToken,
  signingSecret: config.slack.signingSecret,
  socketMode: true,
  appToken: config.slack.appToken,
  logLevel: LogLevel.INFO,
});

// Register Slack handlers
registerCommands(slackApp);
registerActions(slackApp);
registerEvents(slackApp);

// Initialize Express app
const expressApp = express();
const PORT = process.env.PORT || 3000;

// Middleware
expressApp.use(cors());
expressApp.use(express.json());
expressApp.use(express.urlencoded({ extended: true }));

// Request logging middleware
expressApp.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Serve PDF files statically
expressApp.use('/pdfs', express.static(path.join(__dirname, '../storage/salary-statements')));

// API Routes
expressApp.use('/api/auth', authRouter);
expressApp.use('/api/trainers', trainersRouter);
expressApp.use('/api/salary', salaryRouter);
expressApp.use('/api/bsc', bscRouter);

// Health check endpoint
expressApp.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler
expressApp.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handling middleware
expressApp.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start both Slack and Express
async function start(): Promise<void> {
  validateConfig();

  try {
    // Connect to MongoDB
    await connectDatabase();

    // Start Slack Bot
    await slackApp.start();

    // Initialize Cron Jobs
    initializeCronJobs(slackApp);

    // Start Express server
    expressApp.listen(PORT, () => {
      console.log('');
      console.log('='.repeat(60));
      console.log('  Red Mat Pilates Payroll System');
      console.log('='.repeat(60));
      console.log('');
      console.log('✅ Slack Bot is running!');
      console.log('✅ Express API server running on port', PORT);
      console.log('');
      console.log('Available Slack commands:');
      console.log('  /attendance  - Quick link to PunchPass attendance');
      console.log('  /schedule    - Quick link to PunchPass schedule');
      console.log('  /payments    - View salary slips');
      console.log('  /performance - Link to Power BI dashboard');
      console.log('');
      console.log('API Endpoints:');
      console.log(`  GET  http://localhost:${PORT}/api/health`);
      console.log(`  GET  http://localhost:${PORT}/api/trainers`);
      console.log(`  POST http://localhost:${PORT}/api/trainers`);
      console.log(`  POST http://localhost:${PORT}/api/salary/generate`);
      console.log(`  GET  http://localhost:${PORT}/api/salary/statements`);
      console.log('');
    });

    // Setup graceful shutdown
    setupGracefulShutdown();

  } catch (error) {
    console.error('Failed to start the app:', error);
    process.exit(1);
  }
}

start();

import { App, LogLevel } from '@slack/bolt';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import { config } from './config';
import { registerCommands } from './handlers/commands';
import { registerActions } from './handlers/actions';
import { registerEvents } from './handlers/events';
import { connectDatabase, setupGracefulShutdown } from './config/database';
import { authenticateToken, requireAdmin } from './middleware/auth.middleware';
import authRouter from './routes/auth.routes';
import trainersRouter from './routes/trainers.routes';
import salaryRouter from './routes/salary.routes';
import bscRouter from './routes/bsc.routes';
import auditLogRouter from './routes/auditLog.routes';
import trainerLogsRouter from './routes/trainerLogs.routes';
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

// ---------------------------------------------------------------------------
// Security middleware
// ---------------------------------------------------------------------------

// Security headers
expressApp.use(helmet());

// CORS – restrict to known frontend origins
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map(o => o.trim());

expressApp.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  maxAge: 86400, // preflight cache 24h
}));

// Body parsing with size limits
expressApp.use(express.json({ limit: '1mb' }));
expressApp.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Strip MongoDB operator injection ($gt, $ne, etc.) from req.body/query/params
expressApp.use(mongoSanitize() as any);

// Global rate limit – 100 requests per 15 min per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
});
expressApp.use(globalLimiter as any);

// Stricter rate limit on auth endpoints (5 attempts per 15 min)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts, please try again later' },
});
expressApp.use('/api/auth', authLimiter as any);

// Request logging middleware
expressApp.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Serve PDF files – authenticated, admin only
// (Replaces the old unauthenticated express.static handler)
expressApp.use('/pdfs', authenticateToken, requireAdmin, express.static(
  path.join(__dirname, '../storage/salary-statements'),
  { dotfiles: 'deny', index: false }
));

// API Routes
expressApp.use('/api/auth', authRouter);
expressApp.use('/api/trainers', trainersRouter);
expressApp.use('/api/salary', salaryRouter);
expressApp.use('/api/bsc', bscRouter);
expressApp.use('/api/audit-logs', auditLogRouter);
expressApp.use('/api/trainer-logs', trainerLogsRouter);

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
  const isDev = process.env.NODE_ENV === 'development';
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Internal server error',
    ...(isDev && { stack: err.stack })
  });
});

// Slack Socket Mode's internal state machine (finity) throws uncaught errors on
// WebSocket disconnects. Catch them so Express keeps running.
process.on('uncaughtException', (err) => {
  if (err.message?.includes('Unhandled event') && err.stack?.includes('finity')) {
    console.warn('[WARN] Slack Socket Mode disconnect (non-fatal):', err.message);
    return;
  }
  // Re-throw anything else — don't silently swallow real crashes
  console.error('[FATAL] Uncaught exception:', err);
  process.exit(1);
});

// Start both Slack and Express
async function start(): Promise<void> {
  validateConfig();

  // 1. MongoDB – fatal if this fails, nothing else works without it
  try {
    await connectDatabase();
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }

  // 2. Express – start immediately so the API is available
  expressApp.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(60));
    console.log('  Red Mat Pilates Payroll System');
    console.log('='.repeat(60));
    console.log('');
    console.log('[OK] Express API server running on port', PORT);
    console.log('');
    console.log('API Endpoints:');
    console.log(`  GET  http://localhost:${PORT}/api/health`);
    console.log(`  GET  http://localhost:${PORT}/api/trainers`);
    console.log(`  POST http://localhost:${PORT}/api/trainers`);
    console.log(`  POST http://localhost:${PORT}/api/salary/generate`);
    console.log(`  GET  http://localhost:${PORT}/api/salary/statements`);
    console.log('');
  });

  // 3. Slack Bot – non-fatal; API keeps running if this fails
  try {
    await slackApp.start();
    console.log('[OK] Slack Bot is running!');
    console.log('');
    console.log('Available Slack commands:');
    console.log('  /attendance  - Quick link to PunchPass attendance');
    console.log('  /schedule    - Quick link to PunchPass schedule');
    console.log('  /payments    - View salary slips');
    console.log('  /performance - Link to Power BI dashboard');
  } catch (error) {
    console.error('[WARN] Slack Bot failed to start (API is still running):', error);
  }

  // 4. Cron jobs – always initialize; Slack DMs will be skipped if bot is down
  initializeCronJobs(slackApp);

  setupGracefulShutdown();
}

start();

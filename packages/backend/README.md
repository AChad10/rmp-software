# Red Mat Pilates - Backend

Unified backend service combining Slack Bot, Express API, and Cron Jobs for payroll automation.

## Architecture

This backend runs as a **single Node.js process** that handles:

1. **Slack Bot** (Socket Mode) - Trainer dashboard and interactions
2. **Express REST API** - Admin dashboard and BSC form integration
3. **Cron Jobs** (Phase 8) - Automated monthly salary generation
4. **MongoDB Atlas** - Data persistence

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Frameworks**:
  - Slack Bolt SDK (Slack Bot)
  - Express.js (REST API)
  - Mongoose (MongoDB ODM)
- **Authentication**: JWT
- **Scheduling**: node-cron (Phase 8)
- **PDF Generation**: Puppeteer (Phase 2)
- **Email**: Gmail API (Phase 3)

## Setup

### Prerequisites

1. MongoDB Atlas account (free tier works)
2. Slack workspace with app configured
3. Node.js 18+ installed

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### Environment Variables

See `.env.example` for all required variables. Key ones:

- `MONGODB_URI` - MongoDB connection string
- `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET` - Slack credentials
- `JWT_SECRET` - Secret for JWT tokens (change in production!)

## Development

```bash
# Run in development mode (with hot reload)
npm run dev

# Build TypeScript
npm run build

# Run compiled JavaScript
npm start

# Watch mode (recompile on changes)
npm run watch
```

## Database Models

### Trainer
- Slack user mapping
- Salary configuration (base + quarterly bonus)
- BSC scorecard template
- Personalized Google Sheets URLs

### BSCEntry
- Quarterly performance assessments
- Self-scores and validated scores
- Final score calculation
- Payment tracking

### SalaryStatement
- Monthly salary breakdowns
- PDF generation paths
- Gmail draft tracking
- Status (draft/sent/paid)

### AuditLog
- Complete audit trail
- Tracks all CRUD operations
- 2-year TTL (auto-delete old logs)

## API Endpoints

### Health Check
```
GET /api/health
```

### Trainers
```
GET  /api/trainers              - List all trainers
GET  /api/trainers/:id          - Get trainer by MongoDB ID
GET  /api/trainers/user/:userId - Get trainer by Slack user ID
POST /api/trainers              - Create trainer (admin only)
PUT  /api/trainers/:id          - Update trainer (admin only)
DEL  /api/trainers/:id          - Soft delete trainer (admin only)
```

All admin endpoints require:
```
Authorization: Bearer <JWT_TOKEN>
```

## Migration Script

Migrate existing trainers from `src/config/trainers.ts` to MongoDB:

```bash
ts-node scripts/migrate-trainers.ts
```

The migration script:
- Reads trainers from config file
- Creates Trainer documents in MongoDB
- Sets placeholder values for email, phone, salary (admin will update via dashboard)
- Preserves personalized Google Sheets URLs
- Skips trainers already in DB

After migration:
- Trainers.ts remains as fallback
- Slack bot queries MongoDB first
- Admin can update details via dashboard

## Slack Bot Features

### Commands
- `/attendance` - PunchPass attendance link
- `/schedule` - PunchPass schedule
- `/payments` - View salary slips
- `/performance` - Power BI dashboard

### App Home Tab
- Daily tasks (attendance, availability, client history)
- Performance metrics
- Documents (salary slips, Form 16)
- Quick links to resources

### Modals
- Salary statements viewer (Phase 4)
- Scorecard & logs (personalized URLs)
- Form 16 documents

## Express API Features

### CORS
Enabled for admin dashboard and BSC form frontends

### Authentication
- JWT-based authentication
- Admin role required for write operations
- 7-day token expiration

### Error Handling
- Centralized error middleware
- Request logging
- Stack traces in development mode

## Database Connection

- **Auto-retry**: 5 attempts with 5s delay
- **Connection pooling**: Default Mongoose settings
- **Graceful shutdown**: SIGINT/SIGTERM handlers
- **Event logging**: Connection, disconnection, errors

## Project Structure

```
src/
├── app.ts              - Main entry point (Slack + Express)
├── config/
│   ├── database.ts     - MongoDB connection
│   ├── config.ts       - App configuration
│   └── trainers.ts     - Legacy trainer config (fallback)
├── models/             - Mongoose schemas
│   ├── Trainer.ts
│   ├── BSCEntry.ts
│   ├── SalaryStatement.ts
│   └── AuditLog.ts
├── routes/             - Express routes
│   └── trainers.routes.ts
├── controllers/        - Route handlers
│   └── trainers.controller.ts
├── middleware/         - Auth, logging, error handling
│   └── auth.middleware.ts
├── handlers/           - Slack event handlers
│   ├── commands.ts
│   ├── actions.ts
│   └── events.ts
├── views/              - Slack Block Kit views
│   └── home.ts
├── modals/             - Slack modals
│   ├── documents.ts
│   └── scorecardLogs.ts
└── services/           - Business logic (Phase 2+)
scripts/
└── migrate-trainers.ts - Migration script
```

## Next Phases

- **Phase 2**: Salary calculation & PDF generation
- **Phase 3**: Gmail integration
- **Phase 4**: Slack payroll features (salary viewing)
- **Phase 5**: BSC workflow API
- **Phase 6**: BSC form (React)
- **Phase 7**: Admin dashboard (React)
- **Phase 8**: Cron automation
- **Phase 9**: Deployment

## Development Tips

1. **MongoDB Connection**: Use MongoDB Atlas free tier for development
2. **Slack Socket Mode**: No webhooks needed, works locally without ngrok
3. **Hot Reload**: Use `npm run dev` for automatic TypeScript recompilation
4. **Testing API**: Use Postman, Thunder Client, or curl
5. **Slack Testing**: Install app in test workspace, not production

## Common Issues

### MongoDB Connection Fails
- Check `MONGODB_URI` in .env
- Verify MongoDB Atlas IP whitelist (allow your IP or 0.0.0.0/0 for testing)
- Ensure database user has correct permissions

### Slack Bot Not Responding
- Verify Socket Mode is enabled in Slack app settings
- Check `SLACK_APP_TOKEN` is set correctly
- Ensure bot has required OAuth scopes

### TypeScript Errors
- Run `npm run build` to see compilation errors
- Ensure `@rmp/shared-types` is built first
- Check import paths are correct

## License

ISC - Red Mat Pilates

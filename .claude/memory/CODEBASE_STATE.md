# RMP Payroll System - Codebase State Documentation

**Last Updated:** February 5, 2026
**System Version:** 1.0.0
**Git Commit:** Latest on main branch

---

## Project Overview

Red Mat Pilates (RMP) Payroll System is a comprehensive automated payroll management and trainer performance evaluation platform. It provides:

- **Quarterly Self-Assessment (BSC)**: Trainers self-evaluate using the Balanced Scorecard method with weighted metrics
- **Secure Token-Based Access**: Trainers access their BSC form via unique, regenerable tokens
- **Automated Salary Calculations**: Bonus calculations based on BSC scores and performance metrics
- **Admin Dashboard**: Complete trainer management, BSC validation, salary statement generation, and audit logging
- **Slack Integration**: (Legacy) Dashboard access through Slack for trainers

---

## Project Architecture

### Monorepo Structure (npm workspaces)

```
rmp-software/
├── packages/
│   ├── backend/              # Express.js + MongoDB API server
│   ├── admin-dashboard/      # React admin interface
│   ├── bsc-form/             # React BSC form application
│   └── shared-types/         # TypeScript interfaces (shared across packages)
├── package.json              # Workspace root config
└── .claude/                  # Claude Code documentation
```

---

## Packages & Their Purposes

### 1. **packages/shared-types**
Type definitions shared across all packages.

**Key Exports:**
- `ITrainer` - Main trainer model
- `IBSCEntry` - BSC submission record
- `ISalaryStatement` - Generated salary statement
- `IAuditLog` - Audit trail
- `IScorecardMetric` - Performance metric definition
- `DEFAULT_TRAINER_SCORECARD` - Default 6-metric scorecard from constants.ts

**Important Note:** The `employeeCode` field was renamed from `memberId` throughout the entire codebase.

---

### 2. **packages/backend**
Node.js Express.js API server with Slack Bot integration.

**Technology Stack:**
- Framework: Express.js
- Database: MongoDB Atlas (required - no local fallback)
- Slack: Slack Bolt (Socket Mode)
- PDF Generation: pdfkit
- Authentication: JWT tokens

**Key Features:**
- RESTful API endpoints
- Slack Bot with Socket Mode
- Scheduled cron jobs
- PDF salary statement generation
- Audit logging

**Directory Structure:**
```
src/
├── app.ts                    # Main entry point, Express + Slack initialization
├── config.ts                 # Environment & global config
├── config/
│   ├── database.ts          # MongoDB Atlas connection (REQUIRED)
│   ├── trainers.ts          # (Legacy) Trainer personalization mapping
├── controllers/              # Request handlers
│   ├── trainers.controller.ts    # Trainer CRUD + token management
│   ├── bsc.controller.ts         # BSC submission & validation
│   ├── salary.controller.ts      # Salary statement generation
│   ├── auth.controller.ts        # JWT authentication
│   └── auditLog.controller.ts    # Audit log queries
├── models/                   # Mongoose schemas
│   ├── Trainer.ts
│   ├── BSCEntry.ts
│   ├── SalaryStatement.ts
│   └── AuditLog.ts
├── routes/                   # Express routers
│   ├── trainers.routes.ts
│   ├── bsc.routes.ts
│   ├── salary.routes.ts
│   ├── auth.routes.ts
│   └── auditLog.routes.ts
├── services/                 # Business logic
│   ├── pdf.service.ts        # PDF generation utility
├── middleware/               # Express middleware
│   ├── auth.middleware.ts    # JWT verification & admin role check
├── handlers/                 # Slack handlers
│   ├── commands.ts
│   ├── actions.ts
│   └── events.ts
├── cron/                     # Scheduled jobs
│   ├── index.ts
│   └── bscReminders.cron.ts
├── templates/                # Email templates
│   └── salaryStatement.html  # HTML email for salary statements
├── views/                    # Slack view templates
└── modals/                   # Slack modal templates
```

**Port:** 3000 (Express API)
**Database:** MongoDB Atlas (connection string via MONGODB_URI env var)

---

### 3. **packages/admin-dashboard**
React + TypeScript admin interface for managing trainers and processing BSC validations.

**Technology Stack:**
- Framework: React 18 + TypeScript
- Build: Vite
- Routing: React Router
- HTTP: Axios

**Key Pages:**
- `/trainers` - Trainer CRUD management
- `/bsc` - BSC submission review and validation
- `/salary` - Salary statement management
- `/audit-logs` - System audit trail

**Key Features:**
- Trainer creation/editing with team assignment (trainer, ops_team, sales_team, other)
- BSC validation workflow
- Salary statement generation and tracking
- Full audit log viewer

---

### 4. **packages/bsc-form**
Standalone React form application for trainers to complete their quarterly self-assessment.

**Technology Stack:**
- Framework: React + TypeScript
- Build: Vite
- URL Pattern:** `/form/:token/:quarter?`

**Key Features:**
- Token-based access (no hardcoded trainer IDs)
- Dynamic scorecard rendering (default or custom per trainer)
- Weighted score calculation
- Quarter selection
- Duplicate submission prevention
- Power BI dashboard placeholder

**Flow:**
1. Trainer receives secure link: `https://bsc-form.rmp.local/form/[64-char-token]/2026-Q1`
2. Fetches trainer data via token: `GET /api/trainers/bsc-access/:token`
3. Loads appropriate scorecard (default or custom)
4. Submits scores: `POST /api/bsc/submit`

---

## Data Models

### ITrainer
```typescript
{
  _id?: string;                      // MongoDB ObjectId
  userId: string;                    // Slack user ID (unique)
  name: string;
  employeeCode: string;              // Employee code (unique, renamed from memberId)
  email: string;                     // Unique, validated
  phone: string;
  joinDate: Date;
  status: 'active' | 'inactive' | 'on_leave';
  team: 'trainer' | 'ops_team' | 'sales_team' | 'other';
  customTeam?: string;               // Only if team === 'other'

  // Salary Configuration
  baseSalary: number;
  quarterlyBonusAmount: number;      // Total bonus pool for the quarter

  // Scorecard Configuration
  useDefaultScorecard: boolean;       // If true, use DEFAULT_TRAINER_SCORECARD
  scorecardTemplate: IScorecardMetric[];  // Custom template (used if useDefaultScorecard === false)

  // BSC Access Security
  bscAccessToken: string;            // 64-char hex token (auto-generated, unique)

  // Legacy URLs (optional)
  balScoreCardUrl?: string;
  trainerLogsUrl?: string;
  paymentAdviceUrl?: string;
  leaveRecordsUrl?: string;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}
```

### IBSCEntry
```typescript
{
  _id?: string;
  trainerId: string;                 // References Trainer._id
  quarter: string;                   // Format: "2026-Q1"
  year: number;
  quarterNumber: 1 | 2 | 3 | 4;

  // Self-Assessment (trainer fills out)
  selfScores: IBSCScore[];          // Array of { metricName, score, notes? }
  selfCalculatedScore: number;       // 0-1 (e.g., 0.85 for 8.5/10)
  submittedAt: Date;

  // Validation (admin reviews and approves)
  status: 'pending_validation' | 'validated' | 'rejected';
  validatedScores?: IBSCScore[];    // Admin may adjust scores
  finalScore?: number;               // 0-1 (admin's validated score)
  validatedBy?: string;              // Admin user ID
  validatedAt?: Date;
  validationNotes?: string;

  // Payment Tracking
  bonusPaidInMonth?: string;        // Format: "2026-02"
  bonusPaid: boolean;

  // Audit
  createdAt: Date;
  updatedAt: Date;
}
```

**Unique Constraint:** `{ trainerId: 1, quarter: 1 }` - One entry per trainer per quarter

### ISalaryStatement
```typescript
{
  _id?: string;
  trainerId: string;                 // References Trainer._id
  trainerName: string;
  month: string;                     // Format: "2026-03"
  year: number;
  monthNumber: number;

  // Salary Breakdown
  baseSalary: number;
  quarterlyBonusAmount: number;      // The configured bonus pool
  bscScore: number;                  // 0-1 (trainer's validated BSC score)
  calculatedBonus: number;           // quarterlyBonusAmount * bscScore
  totalSalary: number;               // baseSalary + calculatedBonus

  // References
  bscEntryId?: string;               // Link to validated BSC entry

  // PDF & Email
  pdfPath: string;                   // Filesystem path
  pdfUrl: string;                    // Publicly accessible URL
  gmailDraftId?: string;             // Gmail draft ID
  gmailDraftUrl?: string;            // Gmail draft URL

  // Status
  status: 'draft' | 'sent' | 'paid';
  sentAt?: Date;
  paidAt?: Date;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}
```

**Unique Constraint:** `{ trainerId: 1, month: 1 }` - One statement per trainer per month

### IAuditLog
```typescript
{
  _id?: string;
  userId: string;                    // Who performed the action
  userName: string;
  action: string;                    // "create", "update", "delete", "validate", etc.
  entity: string;                    // "trainer", "bsc", "salary", etc.
  entityId: string;                  // ID of affected entity
  changes?: Record<string, any>;    // What changed (before/after)
  metadata?: Record<string, any>;   // Additional context
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}
```

**TTL Index:** Auto-deletes logs after 2 years

---

## API Endpoints

### Authentication
- `POST /api/auth/login` - JWT token issuance (not fully implemented)
- `GET /api/auth/verify` - Verify JWT token

### Trainers (CRUD + Token Management)
- `GET /api/trainers` - List all trainers
- `GET /api/trainers/:id` - Get trainer by MongoDB ID
- `GET /api/trainers/user/:userId` - Get trainer by Slack user ID
- `GET /api/trainers/bsc-access/:token` - **Secure access** - Get trainer by BSC token
- `POST /api/trainers` - Create trainer (admin only)
- `PUT /api/trainers/:id` - Update trainer (admin only)
- `DELETE /api/trainers/:id` - Delete trainer (admin only)
- `POST /api/trainers/:id/regenerate-bsc-token` - Generate new BSC token (admin only)

### BSC (Balanced Scorecard)
- `GET /api/bsc` - List all BSC entries
- `GET /api/bsc/pending` - Get pending validation entries (admin only)
- `GET /api/bsc/trainer/:trainerId` - Get entries for specific trainer
- `POST /api/bsc/submit` - Trainer submits self-assessment
- `PUT /api/bsc/:id/validate` - Admin validates and scores (admin only)

### Salary
- `GET /api/salary/statements` - List all salary statements
- `GET /api/salary/statements/:id` - Get specific statement
- `POST /api/salary/generate` - Generate statements for a month (admin only)
- `GET /api/salary/statements/:id/pdf` - Download PDF

### Audit Logs
- `GET /api/audit-logs` - List all audit entries
- `GET /api/audit-logs/entity/:entity/:entityId` - Logs for specific entity
- `GET /api/audit-logs/user/:userId` - Logs by specific user

### Health
- `GET /api/health` - API health check

---

## BSC (Balanced Scorecard) Flow

### 1. **Trainer Creation**
Admin creates trainer in dashboard or via API:
- Automatically generates unique `bscAccessToken` (64-char hex)
- Selects `useDefaultScorecard: true/false`
- If custom: defines `scorecardTemplate` (IScorecardMetric[])

### 2. **Token Generation & Distribution**
BSC form URL format: `https://bsc-form.rmp.local/form/{token}/{quarter}`

Example: `https://bsc-form.rmp.local/form/a1b2c3d4e5f6/2026-Q1`

Admin can regenerate token via: `POST /api/trainers/:id/regenerate-bsc-token`

### 3. **Trainer Access & Submission**
1. Trainer clicks link → BSCForm component loads
2. Fetches trainer data: `GET /api/trainers/bsc-access/{token}`
3. Loads scorecard (default or custom)
4. Trainer rates each metric (0-10 scale or custom min/max)
5. Submits: `POST /api/bsc/submit`
   - Payload: `{ trainerId, quarter, selfScores: [...] }`
   - Status set to `pending_validation`

### 4. **Admin Validation**
1. Admin reviews submission in dashboard
2. May adjust trainer's scores (`validatedScores`)
3. Submits validation: `PUT /api/bsc/:id/validate`
   - Status changed to `validated`
   - `finalScore` calculated from validated scores
   - `validatedAt` timestamp set
4. Optional: Reject if needed (status: `rejected`)

### 5. **Salary Generation**
Monthly cron job or admin trigger:
1. Finds validated BSC entries for the quarter
2. Uses `finalScore` (or `selfCalculatedScore` if not validated)
3. Calculates: `calculatedBonus = quarterlyBonusAmount * finalScore`
4. Generates PDF salary statement
5. Creates SalaryStatement record

---

## Environment Variables

### Required (Backend)
```env
# MongoDB Atlas (REQUIRED - no local fallback)
MONGODB_URI=mongodb+srv://username:password@cluster.xxxxx.mongodb.net/rmp-payroll

# Slack Bot Credentials
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_SIGNING_SECRET=...

# Server
NODE_ENV=development|production
PORT=3000
```

### Optional
```env
# Email (for salary statements)
GMAIL_USER=...
GMAIL_PASSWORD=...

# JWT Secret
JWT_SECRET=your-secret-key

# Power BI Dashboard URL
POWERBI_URL=https://...
```

---

## How to Run the Project

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- MongoDB Atlas account with connection string

### Setup

```bash
# Install all workspace dependencies
npm install

# OR install specific workspace
npm install --workspace=packages/backend
npm install --workspace=packages/admin-dashboard
npm install --workspace=packages/bsc-form

# Create .env file in packages/backend
cp .env.example .env
# Edit .env and add MONGODB_URI, SLACK credentials
```

### Development

```bash
# Run all services concurrently (recommended for full-stack dev)
npm run dev:all

# Run individual services
npm run dev:backend      # http://localhost:3000
npm run dev:admin        # http://localhost:5173
npm run dev:bsc          # http://localhost:5174

# Build all services
npm run build:all

# Start backend (after build)
npm run start:backend
```

### Database Initialization

MongoDB collections are auto-created by Mongoose on first run. No manual migrations needed.

**Collections created:**
- `trainers` - Trainer records
- `bsc_entries` - BSC submissions
- `salary_statements` - Generated statements
- `audit_logs` - Audit trail

---

## Key Technical Details

### BSC Access Token Security
- Generated using `crypto.randomBytes(32).toString('hex')` - 64 characters
- Unique constraint in database
- Cannot be guessed or brute-forced
- Regenerable by admin if compromised
- No hardcoded trainer IDs in URLs

### Weighted Score Calculation
```
For each metric:
  normalizedScore = trainerScore / metricMaxScore  (converts to 0-1)
  weightedContribution = normalizedScore * metricWeight

totalWeightedScore = sum of all weighted contributions
finalScore = (totalWeightedScore / 100) * 10  (scales to 0-10)
```

### Salary Calculation
```
calculatedBonus = quarterlyBonusAmount * finalScore
totalSalary = baseSalary + calculatedBonus
```

Example:
- Base salary: $2,000
- Quarterly bonus amount: $500
- BSC score: 0.85 (8.5/10)
- Calculated bonus: $500 * 0.85 = $425
- Total: $2,000 + $425 = $2,425

### PDF Generation
- Uses `pdfkit` library
- Template: `src/templates/salaryStatement.html`
- Stored in: `storage/salary-statements/`
- Served via: `/pdfs/[filename]`

### Audit Logging
Every significant action is logged:
- Trainer creation/update/deletion
- BSC submission/validation
- Salary statement generation
- Token regeneration

Includes: `userId`, `action`, `entity`, `entityId`, `changes`, `timestamp`

---

## MongoDB Collections & Indexes

### trainers
```
Unique: userId, email, employeeCode, bscAccessToken
Indexes: status, name, userId, bscAccessToken
```

### bsc_entries
```
Unique: trainerId + quarter (compound)
Indexes: trainerId, status, trainerId+status, trainerId+quarter+timestamp
TTL: None (keep indefinitely for audit)
```

### salary_statements
```
Unique: trainerId + month (compound)
Indexes: trainerId, status, month, year+monthNumber, trainerId+month
TTL: None
```

### audit_logs
```
Unique: None
Indexes: userId, action, entity, entityId, timestamp, entity+entityId+timestamp
TTL: 63072000 seconds (2 years)
```

---

## Known Issues & TODOs

### Current Status
- [x] Token-based BSC access implemented
- [x] Weighted scorecard calculation
- [x] Audit logging
- [x] Salary statement PDF generation
- [x] Admin dashboard (React)
- [x] BSC form (React)
- [x] Trainer CRUD management
- [x] MongoDB Atlas (required)
- [x] Renamed memberId → employeeCode

### Future Enhancements
- [ ] Power BI dashboard integration
- [ ] Gmail integration for salary statement distribution
- [ ] Slack bot integration refinement
- [ ] Role-based access control (RBAC) expansion
- [ ] Bulk trainer import via CSV
- [ ] Custom email notifications
- [ ] Performance comparison analytics
- [ ] Trainer performance trends

### Known Limitations
- No local MongoDB fallback - Atlas required
- Slack bot handlers not fully configured (see app.ts)
- Power BI dashboard is placeholder only
- Gmail integration not implemented

---

## File Dependency Map

### Critical Files (Must not break)
1. `packages/shared-types/src/index.ts` - All type definitions
2. `packages/backend/src/models/` - MongoDB schemas
3. `packages/backend/src/routes/` - API endpoints
4. `packages/backend/src/config/database.ts` - MongoDB connection
5. `packages/bsc-form/src/components/BSCForm.tsx` - BSC form UI

### Configuration Files
- `packages/backend/.env` - Secrets and connection strings
- `packages/backend/src/config.ts` - Global configuration
- All `vite.config.ts` files - Build configurations

### Key Service Files
- `packages/backend/src/controllers/` - Business logic endpoints
- `packages/backend/src/services/pdf.service.ts` - PDF generation
- `packages/admin-dashboard/src/api/` - Frontend API clients

---

## Version History

### v1.0.0 (Current - Feb 5, 2026)
- Initial production release
- Trainer management with token-based BSC access
- Weighted scorecard validation
- Automated salary calculation
- Comprehensive audit logging
- Admin dashboard and BSC form

---

## Session Changes Summary

### February 5, 2026 Changes
1. **Bug Fixes**
   - Fixed BSC option visibility for ops_team and sales_team in Trainers page
   - Fixed tooltip cutoff - now positions below text
   - Created missing audit log endpoints and controller

2. **Security Enhancement - Token-Based BSC Access**
   - Added `bscAccessToken` field to Trainer model (64-char secure token)
   - New endpoint: `GET /api/trainers/bsc-access/:token`
   - New endpoint: `POST /api/trainers/:id/regenerate-bsc-token`
   - Updated BSC form to use `/form/:token/:quarter` pattern
   - Trainers no longer accessible via hardcoded IDs

3. **Refactoring - memberId → employeeCode**
   - Renamed across entire codebase
   - Files modified:
     - `shared-types/src/index.ts`
     - `backend/src/models/Trainer.ts`
     - `backend/src/controllers/trainers.controller.ts`
     - `backend/src/controllers/bsc.controller.ts`
     - `backend/src/controllers/salary.controller.ts`
     - `backend/src/services/pdf.service.ts`
     - `backend/src/templates/salaryStatement.html`
     - `admin-dashboard/src/pages/Trainers.tsx`

4. **Deployment Changes**
   - Removed local MongoDB fallback
   - MONGODB_URI env var now REQUIRED

---

## Next Session Recommendations

1. **Implement Power BI Integration**
   - Get actual Power BI dashboard URLs
   - Embed in BSC form for trainers to review before self-assessment

2. **Gmail Integration**
   - Send salary statements via email
   - Store draft URLs in SalaryStatement model

3. **Slack Bot Refinement**
   - Complete handler implementations
   - Test Socket Mode connection

4. **Testing**
   - Add unit tests for controllers
   - Add integration tests for API endpoints
   - Add E2E tests for BSC flow

5. **Performance Optimization**
   - Add caching for trainer data
   - Optimize database indexes
   - Add pagination to endpoints

---

**Document Created:** February 5, 2026
**Next Review Recommended:** After next session with changes

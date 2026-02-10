# RMP Software - Complete Project Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technologies](#technologies)
4. [System Components](#system-components)
5. [Data Models](#data-models)
6. [NoPassList Payment System](#nopasslist-payment-system)
7. [Razorpay Webhook Setup](#razorpay-webhook-setup)
8. [Development Setup](#development-setup)
9. [Production Deployment](#production-deployment)
10. [API Endpoints](#api-endpoints)
11. [Key Workflows](#key-workflows)

---

## Project Overview

**RMP Software** (Red Mat Pilates Payroll System) is a comprehensive automation system for managing payroll, performance scorecards, and payment reminders for Red Mat Pilates trainers and staff.

### Core Features

1. **Slack Bot Integration** - Commands for attendance, schedule, payments, and performance
2. **Admin Dashboard** - Web interface for managing trainers, salaries, and BSC reviews
3. **BSC (Balanced Scorecard) System** - Quarterly performance tracking with bonus calculations
4. **Automated Salary Generation** - Monthly salary statements with PDF generation and Gmail integration
5. **NoPassList Payment System** - WhatsApp reminders for unpaid classes with Razorpay payment links
6. **Audit Logging** - Complete audit trail of all administrative actions
7. **Trainer Logs** - Google Sheets integration for attendance tracking

---

## Architecture

```
rmp-software/
├── packages/
│   ├── backend/                    # Node.js Express API + Slack Bot
│   │   ├── Port: 3000
│   │   ├── MongoDB database
│   │   ├── Slack Socket Mode integration
│   │   └── Gmail API integration
│   │
│   ├── admin-dashboard/            # React Admin Interface
│   │   ├── Port: 5173
│   │   ├── React + Vite
│   │   ├── Custom CSS (no Tailwind)
│   │   └── Dark/Light theme support
│   │
│   ├── bsc-form/                   # React BSC Submission Form
│   │   ├── Port: 5174
│   │   ├── Trainer self-assessment
│   │   └── Secure token-based access
│   │
│   └── shared-types/               # TypeScript shared types
│       └── Common interfaces and types
│
└── nopasslist/                     # Independent Python System
    ├── Port: 5000
    ├── Flask webhook server
    ├── WhatsApp integration (GupShup)
    ├── Razorpay payment links
    └── CSV-based data processing
```

### System Independence

- **Backend, Admin, BSC Form**: Integrated monorepo with shared types
- **NoPassList**: Completely independent Python system that:
  - Uses its own CSV files (no database integration)
  - Has separate .env configuration
  - Only shares Slack webhook for payment notifications
  - Can be deployed and run independently

---

## Technologies

### Backend Stack
- **Node.js** + **TypeScript**
- **Express.js** - REST API framework
- **MongoDB** - Database with Mongoose ODM
- **Slack Bolt SDK** - Socket Mode integration
- **Razorpay SDK** - Payment integration (backend references only)
- **Gmail API** - Email draft creation
- **Google Sheets API** - Trainer logs integration
- **PDFKit** - PDF generation for salary statements

### Frontend Stack
- **React 18** + **TypeScript**
- **Vite** - Build tool
- **Zustand** - State management
- **CSS Custom Properties** - Theming system

### NoPassList Stack
- **Python 3** + **Flask**
- **Pandas** - CSV data processing
- **Razorpay Python SDK** - Payment link generation
- **Requests** - HTTP client for GupShup WhatsApp API

### Security
- **Helmet.js** - Security headers
- **CORS** - Origin restrictions
- **Rate Limiting** - Express rate limiter
- **MongoDB Sanitization** - Query injection prevention
- **JWT Authentication** - Token-based auth
- **HMAC Signature Verification** - Razorpay webhook security

---

## System Components

### 1. Backend API (`packages/backend/`)

**Key Services:**
- `salary.service.ts` - Salary calculation and PDF generation
- `gmail.service.ts` - Gmail API integration for draft creation
- `sheets.service.ts` - Google Sheets API for trainer logs
- `pdf.service.ts` - PDF generation utilities

**Controllers:**
- `auth.controller.ts` - Authentication (admin login)
- `trainers.controller.ts` - Trainer CRUD operations
- `bsc.controller.ts` - BSC submission and validation
- `salary.controller.ts` - Salary generation and retrieval
- `auditLog.controller.ts` - Audit log queries
- `trainerLogs.controller.ts` - Trainer attendance logs

**Cron Jobs:**
- `bscReminders.cron.ts` - Quarterly BSC submission reminders
- `salaryGeneration.cron.ts` - Monthly salary generation automation

**Slack Handlers:**
- `/attendance` - Link to PunchPass attendance
- `/schedule` - Link to PunchPass schedule
- `/payments` - View salary slips
- `/performance` - Link to Power BI dashboard

### 2. Admin Dashboard (`packages/admin-dashboard/`)

**Pages:**
- `Dashboard.tsx` - Overview statistics
- `Trainers.tsx` - Trainer management with CRUD
- `BSCReview.tsx` - Review and validate BSC submissions
- `Salary.tsx` - Generate and view salary statements
- `TrainerLogs.tsx` - View attendance from Google Sheets
- `AuditLogs.tsx` - View system audit trail
- `Login.tsx` - Admin authentication

**Features:**
- Dark/Light theme toggle (Zustand + CSS variables)
- Professional, minimal design (no emojis)
- Month picker for historical data
- CSV export capabilities
- Modal-based workflows

### 3. BSC Form (`packages/bsc-form/`)

**Purpose:** Trainers submit quarterly self-assessments

**Features:**
- Secure token-based access (no login required)
- Dynamic metric loading based on trainer's scorecard template
- Weighted score calculation
- Success confirmation page

### 4. NoPassList System (`nopasslist/`)

**Purpose:** Send WhatsApp payment reminders for unpaid Pilates classes

**Components:**
- `send_reminders.py` - Main script to process CSV and send reminders
- `webhook_server.py` - Flask server for Razorpay webhooks
- `communication_files/` - CSV data and config

**Features:**
- Processes CSV with class attendance data
- Filters by date (last 6 months), private sessions
- Generates Razorpay payment links
- Sends WhatsApp templates via GupShup
- Receives webhook notifications on payment completion
- Sends Slack notifications to team

---

## Data Models

### Trainer (`ITrainer`)
```typescript
{
  userId: string;              // Slack user ID
  name: string;
  employeeCode: string;
  designation: string;
  panNumber: string;
  email: string;
  phone: string;
  joinDate: Date;
  status: 'active' | 'inactive' | 'on_leave';
  team: 'trainer' | 'ops_team' | 'sales_team' | 'other';
  experienceLevel?: 'junior' | 'senior' | 'master' | 'manager';

  // Salary
  annualCTC: number;
  baseSalary: number;
  quarterlyBonusAmount: number;

  // Scorecard
  useDefaultScorecard: boolean;
  scorecardTemplate: IScorecardMetric[];
  bscAccessToken?: string;      // Secure BSC form access
}
```

### BSC Entry (`IBSCEntry`)
```typescript
{
  trainerId: string;
  quarter: string;              // "2026-Q1"
  year: number;
  quarterNumber: 1 | 2 | 3 | 4;

  // Self-Assessment
  selfScores: IBSCScore[];
  selfCalculatedScore: number;
  submittedAt: Date;

  // Validation
  status: 'pending_validation' | 'validated' | 'rejected';
  validatedScores?: IBSCScore[];
  finalScore?: number;
  validatedBy?: string;
  validationNotes?: string;

  // Payment Tracking
  bonusPaidInMonth?: string;    // "2026-02"
  bonusPaid: boolean;
}
```

### Salary Statement (`ISalaryStatement`)
```typescript
{
  trainerId: string;
  month: string;                // "2026-03"
  baseSalary: number;
  quarterlyBonusAmount: number;
  bscScore: number;             // 0-1 (e.g., 0.85)
  calculatedBonus: number;
  totalSalary: number;

  pdfPath: string;
  pdfUrl: string;
  gmailDraftId?: string;
  gmailDraftUrl?: string;

  status: 'draft' | 'sent' | 'paid';
}
```

### Audit Log (`IAuditLog`)
```typescript
{
  userId: string;
  userName: string;
  action: string;               // "create", "update", "delete"
  entity: string;               // "trainer", "bsc", "salary"
  entityId: string;
  changes?: Record<string, any>;
  timestamp: Date;
}
```

---

## NoPassList Payment System

### How It Works

1. **Data Input**
   - Upload `classes.csv` with columns:
     - Date, Class Attended, Last Name, First Name, Flag, Email, Phone, Amount

2. **Processing** (`send_reminders.py`)
   - Filters classes from last 6 months
   - Filters private sessions (configurable)
   - Groups by phone number and month
   - Calculates total unpaid amount per customer

3. **Payment Link Generation**
   - Creates Razorpay payment link for each customer
   - Stores payment link ID → customer mapping in `payment_tracking.json`
   - Links include customer name, amount, class details

4. **WhatsApp Reminder**
   - Sends template message via GupShup API
   - Includes: name, amount breakdown, payment link
   - Tracks last sent date to avoid spam (6-day cooldown)

5. **Payment Webhook**
   - Webhook receives `payment_link.paid` events from Razorpay
   - Looks up customer details from `payment_tracking.json`
   - Sends Slack notification with payment confirmation

### CSV Format

```csv
Date,Class Attended,Last Name,First Name,Flag,Customer Email,Customer Phone Number,Amount
15-01-2026,Private Session,Sharma,Priya,,priya@example.com,9876543210,500
20-01-2026,Private Session,Kumar,Raj,,raj@example.com,9876543211,500
```

### Configuration

`communication_files/No_Pass_List_V1/Private_Or_Group_Config/config.json`:
```json
{
  "only_private_sessions": true
}
```

---

## Razorpay Webhook Setup

### Overview

The webhook server (`nopasslist/webhook_server.py`) listens for Razorpay payment notifications and sends Slack alerts when payments are completed.

### Development Setup

#### 1. Configure Environment Variables

Edit `nopasslist/.env`:

```bash
# Razorpay Credentials
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXX          # Test mode for dev
RAZORPAY_KEY_SECRET=your_secret_key_here
RAZORPAY_WEBHOOK_SECRET=whsec_XXXXXXXXXX

# Slack Webhook (for payment notifications)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# GupShup WhatsApp (for reminders)
GUPSHUP_API_KEY=sk_your_key_here
WHATSAPP_SOURCE_NUMBER=919220652623
TEMPLATE_ID=a3c8e92f-259a-41c5-ad40-b50663aac72a

# Webhook Server
WEBHOOK_PORT=5000
```

#### 2. Start the Webhook Server

**Option A: Start everything**
```bash
# From rmp-software root
npm run dev:all
```
This starts:
- Backend API (port 3000)
- Admin Dashboard (port 5173)
- BSC Form (port 5174)
- NoPassList Webhook (port 5000)

**Option B: Start webhook only**
```bash
npm run dev:nopasslist
```

#### 3. Expose Webhook Locally for Testing

Use **ngrok** to expose your local webhook server to the internet:

```bash
# Install ngrok (if not already installed)
brew install ngrok

# Expose port 5000
ngrok http 5000
```

Ngrok will output a forwarding URL like:
```
Forwarding    https://abc123.ngrok.io -> http://localhost:5000
```

#### 4. Configure Razorpay Webhook

1. **Log in to Razorpay Dashboard**
   - Go to: https://dashboard.razorpay.com

2. **Navigate to Webhooks**
   - Settings → Webhooks → Add New Webhook

3. **Configure Webhook**
   - **Webhook URL**: `https://abc123.ngrok.io/webhook/razorpay`
   - **Secret**: Generate a secret or use existing one (copy to `.env`)
   - **Active Events**: Select `payment_link.paid`

4. **Save Configuration**

#### 5. Test the Webhook

**Test 1: Health Check**
```bash
curl http://localhost:5000/health
# Should return: {"status":"healthy"}
```

**Test 2: Send Test Reminder**
```bash
cd nopasslist
source venv/bin/activate  # or npvenv/bin/activate
python send_reminders.py
```

This will:
- Process `classes.csv`
- Generate payment links
- Send WhatsApp reminders
- Store payment tracking data

**Test 3: Simulate Payment**
- Use Razorpay test mode to create a test payment
- Or click on a payment link and complete payment with test card:
  - Card: `4111 1111 1111 1111`
  - Expiry: Any future date
  - CVV: Any 3 digits

**Test 4: Verify Webhook Received**
- Check webhook logs:
  ```bash
  tail -f nopasslist/logs/webhook.log
  ```
- You should see:
  ```
  2026-02-10 10:30:45 - INFO - Received webhook event: payment_link.paid
  2026-02-10 10:30:45 - INFO - Payment received: pay_XXXXXX for payment link plink_XXXXXX
  2026-02-10 10:30:45 - INFO - Slack notification sent for payment pay_XXXXXX
  ```

**Test 5: Check Slack Notification**
- Verify Slack channel received payment notification with:
  - Customer name
  - Amount paid
  - Phone number
  - Payment ID
  - Classes paid for

### Production Deployment

#### 1. Server Requirements

- **Server**: AWS EC2 / DigitalOcean Droplet / any Linux server
- **Python**: 3.8+
- **Process Manager**: PM2 (for Node.js backend) + systemd/PM2 (for Python webhook)

#### 2. Deploy NoPassList Webhook

**SSH into server:**
```bash
ssh user@your-server.com
cd /home/user/rmp-software
```

**Setup Python environment:**
```bash
cd nopasslist
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Configure production `.env`:**
```bash
cp .env.example .env
nano .env
```

Update with **production** credentials:
```bash
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXX          # LIVE mode
RAZORPAY_KEY_SECRET=your_live_secret
RAZORPAY_WEBHOOK_SECRET=whsec_live_XXXXXXXXXX
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/LIVE/WEBHOOK/URL
```

**Start webhook with PM2:**
```bash
# Option 1: Using PM2 with Python interpreter
pm2 start venv/bin/python --name nopasslist-webhook -- webhook_server.py

# Option 2: Create PM2 ecosystem file
cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [
    {
      name: 'nopasslist-webhook',
      script: 'webhook_server.py',
      interpreter: 'venv/bin/python',
      cwd: '/home/user/rmp-software/nopasslist',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
EOF

pm2 start ecosystem.config.js
```

**Save PM2 configuration:**
```bash
pm2 save
pm2 startup  # Follow instructions to enable on boot
```

#### 3. Setup Cron for Daily Reminders

```bash
crontab -e
```

Add:
```bash
# Send NoPassList reminders daily at 10 AM
0 10 * * * cd /home/user/rmp-software/nopasslist && venv/bin/python send_reminders.py >> logs/cron.log 2>&1
```

#### 4. Configure Razorpay Production Webhook

1. **Log in to Razorpay Dashboard** (Production)
2. **Navigate to Webhooks**
3. **Add New Webhook**:
   - **URL**: `https://your-domain.com/webhook/razorpay`
   - **Secret**: Use the production webhook secret from `.env`
   - **Events**: `payment_link.paid`

**IMPORTANT**: Update DNS to point to your server, and ensure:
- **HTTPS** is configured (use Let's Encrypt)
- **Firewall** allows port 5000 (or use reverse proxy)
- **Nginx reverse proxy** recommended:

```nginx
# /etc/nginx/sites-available/rmp-software
server {
    listen 80;
    server_name your-domain.com;

    # Redirect to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Razorpay webhook endpoint
    location /webhook/razorpay {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Admin Dashboard
    location / {
        root /home/user/rmp-software/packages/admin-dashboard/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

#### 5. Verify Production Webhook

```bash
# Check webhook server status
pm2 status
pm2 logs nopasslist-webhook

# Test health endpoint
curl https://your-domain.com/webhook/razorpay -X GET
# Should redirect to https://your-domain.com/health

curl https://your-domain.com/health
# {"status":"healthy"}

# Check webhook logs
tail -f /home/user/rmp-software/nopasslist/logs/webhook.log
```

### Webhook Security

#### HMAC Signature Verification

The webhook server verifies each request using HMAC-SHA256:

```python
def verify_webhook_signature(payload_body, signature, secret):
    """Verify Razorpay webhook signature."""
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        payload_body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected_signature, signature)
```

**Headers sent by Razorpay:**
- `X-Razorpay-Signature` - HMAC signature of request body

**Verification process:**
1. Webhook receives POST request
2. Extracts `X-Razorpay-Signature` header
3. Computes expected signature using webhook secret
4. Compares signatures using `hmac.compare_digest()` (timing-safe)
5. Rejects request if signatures don't match (returns 401)

### Webhook Payload Example

```json
{
  "event": "payment_link.paid",
  "payload": {
    "payment_link": {
      "entity": {
        "id": "plink_XXXXXXXXXXXXX",
        "amount": 50000,
        "currency": "INR",
        "description": "Payment for classes - Priya",
        "customer": {
          "name": "Priya Sharma",
          "contact": "9876543210"
        }
      }
    },
    "payment": {
      "entity": {
        "id": "pay_XXXXXXXXXXXXX",
        "amount": 50000,
        "currency": "INR",
        "status": "captured"
      }
    }
  }
}
```

### Troubleshooting

**Issue: Port 5000 already in use**
```bash
# Find process using port 5000
lsof -i :5000

# Kill process
kill -9 <PID>

# Or change port in .env
echo "WEBHOOK_PORT=5001" >> nopasslist/.env
```

**Issue: Webhook not receiving events**
- Check ngrok tunnel is active
- Verify Razorpay webhook URL is correct
- Check webhook logs: `tail -f nopasslist/logs/webhook.log`
- Test with Razorpay webhook testing tool in dashboard

**Issue: Signature verification fails**
- Ensure `RAZORPAY_WEBHOOK_SECRET` matches Razorpay dashboard
- Check for whitespace in `.env` file
- Verify webhook secret is the same in both dev and production

**Issue: Slack notifications not sent**
- Verify `SLACK_WEBHOOK_URL` is correct
- Test Slack webhook directly:
  ```bash
  curl -X POST -H 'Content-type: application/json' \
    --data '{"text":"Test notification"}' \
    YOUR_SLACK_WEBHOOK_URL
  ```

---

## Development Setup

### Prerequisites

- **Node.js** 18+ and npm 9+
- **Python** 3.8+
- **MongoDB** (local or Atlas)
- **Slack Workspace** with bot configured
- **Gmail Account** with API enabled
- **Google Cloud Project** with Sheets API enabled
- **Razorpay Account** (test/live)
- **GupShup Account** for WhatsApp

### Environment Variables

#### Backend (`.env` in `packages/backend/`)

```bash
# Server
NODE_ENV=development
PORT=3000

# MongoDB
MONGO_URI=mongodb://localhost:27017/rmp-payroll
# Or Atlas: mongodb+srv://username:password@cluster.mongodb.net/rmp-payroll

# Slack Bot
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_SIGNING_SECRET=your-signing-secret

# JWT Authentication
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_EXPIRES_IN=7d

# Admin Credentials
ADMIN_EMAIL=admin@redmatpilates.com
ADMIN_PASSWORD=your-secure-password

# Gmail API (OAuth2)
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REDIRECT_URI=http://localhost:3000/oauth2callback
GMAIL_REFRESH_TOKEN=your-refresh-token

# Google Sheets API
GOOGLE_SHEETS_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
TRAINER_LOGS_SPREADSHEET_ID=your-spreadsheet-id

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
```

#### NoPassList (`.env` in `nopasslist/`)

```bash
# GupShup WhatsApp
GUPSHUP_API_KEY=sk_your_api_key
WHATSAPP_SOURCE_NUMBER=919220652623
TEMPLATE_ID=a3c8e92f-259a-41c5-ad40-b50663aac72a
SRC_NAME=RedmatBot

# Razorpay
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=your_secret_key
RAZORPAY_WEBHOOK_SECRET=whsec_XXXXXXXXXX

# Slack Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Webhook Server
WEBHOOK_PORT=5000
```

### Installation

```bash
# Clone repository
git clone <repository-url>
cd rmp-software

# Install root dependencies
npm install

# Setup NoPassList Python environment
npm run setup:nopasslist

# Or manually:
cd nopasslist
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..
```

### Running Development Environment

**Start everything:**
```bash
npm run dev:all
```

**Or start individually:**
```bash
# Backend API + Slack Bot
npm run dev:backend

# Admin Dashboard
npm run dev:admin

# BSC Form
npm run dev:bsc

# NoPassList Webhook
npm run dev:nopasslist
```

### Building for Production

```bash
# Build all packages
npm run build:all

# Or individually
npm run build:backend
npm run build:admin
npm run build:bsc
```

---

## Production Deployment

### Server Requirements

- **OS**: Ubuntu 20.04+ or similar Linux
- **Node.js**: 18+
- **Python**: 3.8+
- **MongoDB**: 4.4+ (Atlas recommended)
- **Nginx**: For reverse proxy
- **PM2**: Process manager
- **SSL**: Let's Encrypt certificates

### Deployment Steps

#### 1. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python
sudo apt install -y python3 python3-pip python3-venv

# Install MongoDB (or use Atlas)
# Follow: https://docs.mongodb.com/manual/installation/

# Install Nginx
sudo apt install -y nginx

# Install PM2
sudo npm install -g pm2
```

#### 2. Clone and Build

```bash
# Clone repository
cd /home/user
git clone <repository-url> rmp-software
cd rmp-software

# Install dependencies
npm install
npm run setup:nopasslist

# Build production bundles
npm run build:all
```

#### 3. Configure Environment

```bash
# Backend .env
cp packages/backend/.env.example packages/backend/.env
nano packages/backend/.env  # Update with production values

# NoPassList .env
cp nopasslist/.env.example nopasslist/.env
nano nopasslist/.env  # Update with production values
```

#### 4. Start Services with PM2

```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [
    {
      name: 'rmp-backend',
      script: 'packages/backend/dist/app.js',
      cwd: '/home/user/rmp-software',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 2,
      exec_mode: 'cluster'
    },
    {
      name: 'nopasslist-webhook',
      script: 'webhook_server.py',
      interpreter: 'venv/bin/python',
      cwd: '/home/user/rmp-software/nopasslist',
      env: {
        WEBHOOK_PORT: 5000
      }
    }
  ]
};
EOF

# Start all services
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions
```

#### 5. Configure Nginx

```bash
# Create site configuration
sudo nano /etc/nginx/sites-available/rmp-software
```

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # API Endpoints
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Webhook Endpoint
    location /webhook {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Admin Dashboard
    location / {
        root /home/user/rmp-software/packages/admin-dashboard/dist;
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }

    # BSC Form
    location /bsc {
        alias /home/user/rmp-software/packages/bsc-form/dist;
        try_files $uri $uri/ /bsc/index.html;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/rmp-software /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 6. Setup SSL with Let's Encrypt

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal (certbot creates this automatically)
sudo systemctl status certbot.timer
```

#### 7. Setup Cron Jobs

```bash
crontab -e
```

Add:
```bash
# Daily NoPassList reminders at 10 AM
0 10 * * * cd /home/user/rmp-software/nopasslist && venv/bin/python send_reminders.py >> logs/cron.log 2>&1

# Weekly MongoDB backup at 2 AM Sunday
0 2 * * 0 mongodump --uri="mongodb://localhost:27017/rmp-payroll" --out=/home/user/backups/mongo/$(date +\%Y-\%m-\%d)

# Monthly log rotation
0 0 1 * * find /home/user/rmp-software/nopasslist/logs -name "*.log" -mtime +30 -delete
```

---

## API Endpoints

### Authentication

```
POST   /api/auth/login              - Admin login
POST   /api/auth/verify             - Verify JWT token
```

### Trainers

```
GET    /api/trainers                - List all trainers
GET    /api/trainers/:id            - Get trainer by ID
POST   /api/trainers                - Create new trainer (admin)
PUT    /api/trainers/:id            - Update trainer (admin)
DELETE /api/trainers/:id            - Delete trainer (admin)
```

### BSC (Balanced Scorecard)

```
GET    /api/bsc                     - List BSC entries (admin)
GET    /api/bsc/:id                 - Get BSC entry by ID
GET    /api/bsc/trainer/:trainerId  - Get trainer's BSC history
POST   /api/bsc/submit              - Submit BSC (trainer via token)
PUT    /api/bsc/:id/validate        - Validate BSC (admin)
GET    /api/bsc/access/:token       - Get BSC form access (trainer)
```

### Salary

```
GET    /api/salary/statements       - List salary statements (admin)
GET    /api/salary/statements/:id   - Get salary statement by ID
POST   /api/salary/generate         - Generate salary statements (admin)
GET    /api/salary/trainer/:trainerId - Get trainer's salary history
```

### Audit Logs

```
GET    /api/audit-logs              - List audit logs (admin)
GET    /api/audit-logs/:id          - Get audit log by ID
GET    /api/audit-logs/entity/:entityId - Get logs for entity
```

### Trainer Logs

```
GET    /api/trainer-logs            - Fetch trainer attendance from Google Sheets
POST   /api/trainer-logs/drafts     - Create Gmail drafts with trainer logs
```

### Webhook (NoPassList)

```
POST   /webhook/razorpay            - Razorpay payment webhook
GET    /health                      - Health check
```

---

## Key Workflows

### 1. Quarterly BSC Workflow

**Timeline:**
- **Week 1**: System sends Slack reminders to trainers
- **Weeks 2-3**: Trainers submit self-assessments via BSC form
- **Week 4**: Admin reviews and validates submissions
- **Month Following Quarter**: Bonus included in salary statement

**Steps:**

1. **Trainer Receives Reminder** (Automated)
   - Cron job sends Slack DM with BSC form link
   - Link includes secure token: `https://your-domain.com/bsc?token=abc123`

2. **Trainer Submits BSC**
   - Opens form, sees their custom scorecard metrics
   - Enters self-scores for each metric
   - System calculates weighted total score
   - Submits form → Status: `pending_validation`

3. **Admin Validates BSC**
   - Logs into admin dashboard
   - Reviews trainer's self-scores
   - Adjusts scores if needed
   - Adds validation notes
   - Clicks "Validate" → Status: `validated`

4. **Bonus Calculation**
   - Next salary generation includes bonus
   - Formula: `bonus = quarterlyBonusAmount * (finalScore / maxScore)`
   - BSC entry marked as `bonusPaid: true`

### 2. Monthly Salary Generation

**Timeline:**
- **1st of each month**: Automated generation (cron job)
- **Manual trigger**: Admin can generate anytime

**Steps:**

1. **Automated Trigger**
   - Cron job runs: `salaryGeneration.cron.ts`
   - Generates statements for all active trainers

2. **Salary Calculation**
   - Base salary from trainer profile
   - Check if quarter's bonus should be paid this month
   - If yes: Calculate bonus based on validated BSC score
   - Total = Base + Bonus

3. **PDF Generation**
   - Create salary statement PDF using `pdf.service.ts`
   - Include: breakdown, BSC score, bonus calculation
   - Save to: `storage/salary-statements/`

4. **Gmail Draft Creation**
   - Use Gmail API to create email draft
   - Attach PDF
   - Email subject: "Salary Statement - [Month]"
   - Store draft ID and URL

5. **Admin Review**
   - Admin reviews statements in dashboard
   - Can regenerate if needed
   - Manually sends emails from Gmail (drafts already created)

### 3. NoPassList Payment Flow

**Timeline:**
- **Daily at 10 AM**: Automated reminder check
- **Instant**: Payment webhook notifications

**Steps:**

1. **CSV Upload**
   - Admin uploads `classes.csv` to `nopasslist/communication_files/`
   - Contains attendance data with amounts owed

2. **Reminder Script Runs**
   ```bash
   # Triggered by cron or manual run
   python send_reminders.py
   ```

3. **Data Processing**
   - Filters: last 6 months, private sessions only
   - Groups by phone number
   - Calculates total amount owed per customer

4. **Payment Link Generation**
   - Creates Razorpay payment link for each customer
   - Stores mapping: `payment_link_id` → `customer_details`
   - Saves to `payment_tracking.json`

5. **WhatsApp Message Sent**
   - Sends template message via GupShup
   - Includes: name, breakdown, payment link
   - Updates `last_sent.json` (6-day cooldown)

6. **Customer Pays**
   - Customer clicks link, pays via Razorpay
   - Razorpay sends webhook to `/webhook/razorpay`

7. **Webhook Processing**
   - Verifies HMAC signature
   - Looks up customer details from `payment_tracking.json`
   - Sends Slack notification to team

8. **Slack Notification**
   - Team receives instant notification
   - Shows: customer name, amount, phone, classes paid

---

## Current Project State

### Completed Features

- Backend API with full CRUD operations
- Slack Bot with Socket Mode integration
- Admin Dashboard with dark/light theme
- BSC submission and validation system
- Automated salary generation with PDF + Gmail
- NoPassList WhatsApp reminders with Razorpay payments
- Webhook server for payment notifications
- Audit logging for all admin actions
- Trainer logs from Google Sheets
- JWT authentication with rate limiting
- Security middleware (Helmet, CORS, sanitization)

### Technology Stack Summary

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite, Zustand |
| **Backend** | Node.js, Express, TypeScript, MongoDB |
| **Bot** | Slack Bolt SDK (Socket Mode) |
| **Payments** | Razorpay (Node SDK + Python SDK) |
| **Messaging** | GupShup WhatsApp API |
| **Email** | Gmail API (OAuth2) |
| **Sheets** | Google Sheets API |
| **PDF** | PDFKit |
| **Webhook** | Flask (Python) |
| **Security** | JWT, Helmet, CORS, Rate Limiting |
| **Deployment** | PM2, Nginx, Let's Encrypt |

### File Structure

```
rmp-software/
├── .gitignore
├── package.json                     # Root workspace config
├── ecosystem.config.js              # PM2 process configuration
├── PROJECT_DOCUMENTATION.md         # This file
├── SETUP_NOPASSLIST.md             # Quick NoPassList setup guide
│
├── packages/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── app.ts              # Main Express + Slack app
│   │   │   ├── config.ts           # Environment config
│   │   │   ├── config/
│   │   │   │   ├── database.ts     # MongoDB connection
│   │   │   │   └── trainers.ts     # Default scorecard config
│   │   │   ├── controllers/        # API controllers
│   │   │   ├── cron/               # Cron job definitions
│   │   │   ├── handlers/           # Slack command/action handlers
│   │   │   ├── middleware/         # Auth, validation middleware
│   │   │   ├── models/             # Mongoose models
│   │   │   ├── routes/             # Express routes
│   │   │   ├── services/           # Business logic services
│   │   │   ├── templates/          # HTML email templates
│   │   │   └── utils/              # Utility functions
│   │   ├── storage/                # File storage (PDFs)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── admin-dashboard/
│   │   ├── src/
│   │   │   ├── api/                # API client services
│   │   │   ├── components/         # React components
│   │   │   ├── pages/              # Page components
│   │   │   ├── store/              # Zustand stores
│   │   │   ├── App.tsx             # Root component
│   │   │   ├── main.tsx            # Entry point
│   │   │   └── index.css           # Global styles + theme
│   │   ├── index.html
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   ├── bsc-form/
│   │   ├── src/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── shared-types/
│       ├── src/
│       │   ├── index.ts            # Shared TypeScript interfaces
│       │   └── constants.ts        # Shared constants
│       ├── package.json
│       └── tsconfig.json
│
└── nopasslist/                     # Independent Python system
    ├── send_reminders.py           # Main reminder script
    ├── webhook_server.py           # Flask webhook server
    ├── requirements.txt            # Python dependencies
    ├── .env                        # NoPassList config
    ├── .gitignore
    ├── README.md
    ├── GUPSHUP_TEMPLATE.txt        # WhatsApp template
    ├── venv/                       # Python virtual environment
    ├── logs/                       # Log files
    ├── last_sent.json              # Last reminder tracking
    ├── payment_tracking.json       # Payment link tracking
    └── communication_files/
        └── No_Pass_List_V1/
            ├── CSV_File/
            │   └── classes.csv     # Class attendance data
            └── Private_Or_Group_Config/
                └── config.json     # Script configuration
```

### Active Integrations

1. **Slack** - Bot commands and notifications
2. **MongoDB** - Database for all entities
3. **Gmail** - Email draft creation
4. **Google Sheets** - Trainer logs retrieval
5. **Razorpay** - Payment links and webhooks
6. **GupShup** - WhatsApp messaging
7. **Let's Encrypt** - SSL certificates

---

## Next Steps / Potential Enhancements

### Suggested Improvements

1. **NoPassList Enhancements**
   - Add web interface for CSV upload
   - Dashboard for payment tracking
   - Email notifications alongside WhatsApp
   - Multiple template support

2. **Admin Dashboard**
   - Bulk trainer import/export
   - Advanced filtering and search
   - Charts and analytics
   - Email sending directly from dashboard

3. **BSC System**
   - Email notifications for BSC deadlines
   - Historical performance graphs
   - Peer review functionality
   - Custom metric templates per team

4. **Salary System**
   - Deductions and adjustments
   - Tax calculation support
   - Payslip customization
   - Direct bank transfer integration

5. **Security**
   - Two-factor authentication
   - Role-based access control (RBAC)
   - API key management
   - Audit log export

6. **Testing**
   - Unit tests (Jest)
   - Integration tests (Supertest)
   - E2E tests (Playwright)
   - CI/CD pipeline (GitHub Actions)

---

## Support & Maintenance

### Log Files

- **Backend**: PM2 logs (`pm2 logs rmp-backend`)
- **NoPassList Webhook**: `nopasslist/logs/webhook.log`
- **NoPassList Reminders**: `nopasslist/logs/script.log`
- **Nginx**: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`

### Monitoring

```bash
# Check PM2 processes
pm2 status
pm2 monit

# Check Nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log

# Check MongoDB
sudo systemctl status mongod
mongo --eval "db.stats()"

# Check disk space
df -h

# Check memory usage
free -h
```

### Backup Strategy

**Database:**
```bash
# Daily backup
mongodump --uri="mongodb://localhost:27017/rmp-payroll" \
  --out="/backups/mongo/$(date +%Y-%m-%d)"

# Restore
mongorestore --uri="mongodb://localhost:27017/rmp-payroll" \
  /backups/mongo/2026-02-10
```

**Files:**
```bash
# Backup PDFs and logs
tar -czf backup-$(date +%Y-%m-%d).tar.gz \
  packages/backend/storage \
  nopasslist/logs \
  nopasslist/last_sent.json \
  nopasslist/payment_tracking.json
```

### Emergency Contacts

- **Technical Issues**: Contact system administrator
- **Razorpay Support**: https://razorpay.com/support
- **GupShup Support**: https://www.gupshup.io/support
- **Slack Support**: https://slack.com/help

---

## Conclusion

This documentation provides a complete overview of the RMP Software system, with special focus on the Razorpay webhook integration for the NoPassList payment system. The system is designed for scalability, security, and ease of maintenance.

For questions or issues, refer to the relevant section above or check the logs for troubleshooting.

**Version**: 1.0.0
**Last Updated**: 2026-02-10
**Maintained By**: Red Mat Pilates Development Team

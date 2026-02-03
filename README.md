# Red Mat Pilates – Payroll Automation System

Comprehensive payroll automation: Slack bot + REST API + BSC workflow + admin dashboard.
Reduces monthly payroll processing from 4+ hours to < 15 minutes.

---

## Repo Layout

```
rmp-software/                      ← git root
├── packages/
│   ├── backend/                   ← Express API + Slack Bot + Cron (single process)
│   │   ├── src/
│   │   │   ├── app.ts             ← entry: wires Express, Bolt, DB, cron
│   │   │   ├── config.ts          ← env-driven URLs (Fresha, PunchPass, Power BI …)
│   │   │   ├── config/
│   │   │   │   ├── database.ts    ← Mongoose connect with retry
│   │   │   │   └── trainers.ts    ← static Slack-user → Google-Sheets mapping
│   │   │   ├── models/            ← Mongoose schemas: Trainer, BSCEntry, SalaryStatement, AuditLog
│   │   │   ├── routes/            ← Express routers (trainers, bsc, salary)
│   │   │   ├── controllers/       ← route handlers
│   │   │   ├── services/          ← salary calc, PDF gen, Gmail drafts
│   │   │   ├── middleware/        ← JWT auth middleware
│   │   │   ├── cron/              ← salary generation (28th 9 AM) + BSC reminders (quarter end)
│   │   │   ├── handlers/          ← Slack event/action/command handlers
│   │   │   ├── modals/            ← Slack modal builders
│   │   │   ├── views/             ← Slack home-tab builder
│   │   │   └── templates/         ← HTML salary-slip template (rendered → PDF)
│   │   ├── .env.example
│   │   └── package.json
│   │
│   ├── admin-dashboard/           ← React (Vite) – admin UI
│   │   └── src/
│   │       ├── App.tsx            ← React Router setup
│   │       ├── pages/             ← Login, Dashboard, Trainers, BSCReview, Salary, AuditLogs
│   │       ├── components/        ← Layout (sidebar nav), ProtectedRoute, Modal, Badge, Spinner
│   │       ├── api/               ← Axios services wrapping every backend endpoint
│   │       ├── store/             ← Zustand auth store
│   │       └── utils/             ← currency / date formatters
│   │
│   ├── bsc-form/                  ← React (Vite) – trainer self-assessment form
│   │   └── src/
│   │       ├── App.tsx            ← Router: /:trainerId/:quarter, /success
│   │       ├── components/        ← BSCForm (sliders, live score), Success page
│   │       ├── api/               ← trainer fetch + BSC submit
│   │       └── utils/             ← quarter formatting helpers
│   │
│   └── shared-types/              ← TypeScript interfaces shared across all packages
│       └── src/index.ts           ← ITrainer, IBSCEntry, ISalaryStatement, IAuditLog, …
│
├── package.json                   ← npm workspaces root
├── redmat-payroll-system.md       ← original requirements doc
├── IMPLEMENTATION_SUMMARY.md      ← build-phase notes
└── README.md                      ← this file
```

---

## Local Development – Quick Start

```bash
# 1. Install everything (hoists shared deps)
npm install

# 2. Build shared-types once (other packages import it)
npm run build --workspace=packages/shared-types

# 3. Create backend env file
cp packages/backend/.env.example packages/backend/.env
# (edit it – see "Environment Variables" section below)

# 4. Create frontend env files
echo "VITE_API_URL=http://localhost:3000/api" > packages/admin-dashboard/.env
echo "VITE_API_URL=http://localhost:3000/api" > packages/bsc-form/.env

# 5. Run everything
npm run dev:all          # backend + admin + bsc-form in parallel

# Or individually:
npm run dev:backend      # http://localhost:3000
npm run dev:admin        # http://localhost:5173
npm run dev:bsc          # http://localhost:5174
```

Build for production:
```bash
npm run build:all        # compiles backend TS + bundles both React apps
```

---

## What You Need to Set Up (Infrastructure & Services)

The backend is one Node.js process.  The two React apps are static bundles.
You therefore need exactly **four** external services, and one server to host the backend.

### 1. MongoDB Atlas – the database

**What for:** Every piece of data lives here (trainers, BSC scores, salary statements, audit logs).

Steps:
1. Go to <https://www.mongodb.com/cloud/atlas> → sign up (free tier is fine to start).
2. Create a project → Create a cluster (the free "M0" cluster works).
3. Add a database user (note the username + password).
4. Under "Network Access" → add `0.0.0.0/0` for now (lock to your VPS IP later).
5. Under "Connect" → choose "Connect your application" → copy the connection string.
   It looks like: `mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/rmp-payroll?retryWrites=true&w=majority`
6. Paste it into `MONGODB_URI` in the backend `.env`.

Collections created automatically on first write: `trainers`, `bsc_entries`, `salary_statements`, `audit_logs`.

---

### 2. Slack – bot token + app token

**What for:** The Slack bot posts salary info to trainers, sends BSC reminders, and has the existing home-tab dashboard.

Steps:
1. Go to <https://api.slack.com/apps> → Create an app → "From scratch".
2. Name it (e.g. "Red Mat Pilates").  Pick your workspace.
3. Under **Features → Interactivity & Shortcuts**:
   - Turn on Interactivity.
   - You won't need a Request URL if you use Socket Mode (step 5).
4. Under **Features → OAuth & Permissions**:
   - Bot Token Scopes: `chat:write`, `users:read`, `files:write`, `users.conversations:read`.
   - Install the app to your workspace → copy the **Bot User OAuth Token** (`xoxb-…`).
5. Under **Settings → Manifest** or **Settings → General** turn on **Socket Mode**.
   - This creates an **App-Level Token** (`xapp-…`). Copy it.
6. Under **Settings → General** → copy the **Signing Secret**.
7. Put all three into the backend `.env`:
   ```
   SLACK_BOT_TOKEN=xoxb-…
   SLACK_APP_TOKEN=xapp-…
   SLACK_SIGNING_SECRET=…
   ```

Socket Mode means **no public URL is required** for the Slack bot – it connects outbound.

---

### 3. Gmail API – OAuth credentials

**What for:** The salary-generation cron creates Gmail drafts (one per trainer, with the PDF attached).  You review and hit Send.

Steps:
1. Go to <https://console.cloud.google.com> → Create a project (or reuse one).
2. Enable the **Gmail API** (APIs & Services → Enable APIs → search Gmail).
3. Go to **APIs & Services → Credentials → Create credentials → OAuth 2.0 Client IDs**.
   - Application type: **Desktop** (easiest for refresh-token flow).
   - Download the JSON; note `client_id` and `client_secret`.
4. Run the one-time OAuth consent flow (the backend README or the existing `GMAIL_SETUP.md` walks through this) to get a **refresh token**.
5. Put all three into `.env`:
   ```
   GMAIL_CLIENT_ID=…
   GMAIL_CLIENT_SECRET=…
   GMAIL_REFRESH_TOKEN=…
   ```

Also set the CC / BCC addresses for salary emails:
```
DIRECTOR_EMAIL=director@redmatpilates.com
FOUNDING_TRAINER_EMAIL=foundingtrainer@redmatpilates.com
ACCOUNTANT_EMAIL=accountant@redmatpilates.com
```

---

### 4. Vercel – host the two React apps

**What for:** The admin dashboard and BSC form are static React bundles.  Vercel is free for this.

**Admin Dashboard:**
1. Push this repo to GitHub (if not already).
2. Go to <https://vercel.com> → Import the repo.
3. Set **Root Directory** to `packages/admin-dashboard`.
4. Add environment variable: `VITE_API_URL=https://<your-backend-url>/api` (you'll know this after deploying the backend – see next section).
5. Deploy.  Optionally point `admin.redmat.com` at it (Vercel Settings → Domains).

**BSC Form:**
Repeat exactly the same steps but with Root Directory = `packages/bsc-form`.
Optional domain: `bsc.redmat.com`.

---

### 5. VPS – host the backend (Node.js process)

**What for:** The backend runs Express (API), Slack bot (Socket Mode), and the cron jobs – all in one Node.js process.  It needs to stay running 24/7 so the cron fires.

**Recommended:** DigitalOcean Droplet ($6–12 / month), or Railway / Render (both have free tiers with cron support).

#### Option A – DigitalOcean Droplet (most control)

```bash
# 1. Create a $6 Ubuntu droplet.  SSH in.

# 2. Install Node.js 18+ via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
nvm alias default 18

# 3. Clone your repo
git clone <your-github-url>
cd rmp-software
npm install
npm run build:all

# 4. Create the .env file on the server
#    (copy from .env.example, fill in real values – MongoDB URI, Slack tokens, Gmail creds …)
cp packages/backend/.env.example packages/backend/.env
# nano packages/backend/.env   ← paste your real values

# 5. Install PM2 (keeps the process running)
npm install -g pm2

# 6. Start the backend
pm2 start packages/backend/dist/app.js --name rmp-backend
pm2 save
pm2 startup   # follow the command it prints – enables auto-start on reboot

# 7. (Optional) Nginx reverse proxy + SSL
sudo apt install nginx certbot python3-certbot-nginx -y
# Create /etc/nginx/sites-enabled/rmp with:
#   server {
#     server_name api.redmat.com;
#     location / { proxy_pass http://localhost:3000; }
#   }
sudo certbot --nginx -d api.redmat.com
# Certbot auto-renews SSL every 90 days.
```

#### Option B – Railway (zero-config, recommended for speed)

1. <https://railway.app> → New Project → Deploy from GitHub.
2. Select the repo.  Set **Root Directory** to `packages/backend`.
3. Add all `.env` variables in the Railway dashboard.
4. Railway gives you a public URL (e.g. `rmp-backend-production.up.railway.app`).
   Use that as `VITE_API_URL` in Vercel for the React apps.

---

## Environment Variables – Complete Reference

All variables live in **`packages/backend/.env`** unless noted.

| Variable | Required | What it is |
|----------|----------|------------|
| `NODE_ENV` | – | `development` or `production` |
| `PORT` | – | HTTP port (default 3000) |
| `MONGODB_URI` | **yes** | Atlas connection string |
| `SLACK_BOT_TOKEN` | **yes** | `xoxb-…` from Slack app |
| `SLACK_APP_TOKEN` | **yes** | `xapp-…` (Socket Mode) |
| `SLACK_SIGNING_SECRET` | **yes** | From Slack app settings |
| `JWT_SECRET` | **yes** | Any long random string; signs admin-dashboard tokens |
| `GMAIL_CLIENT_ID` | recommended | Google Cloud OAuth client ID |
| `GMAIL_CLIENT_SECRET` | recommended | Google Cloud OAuth secret |
| `GMAIL_REFRESH_TOKEN` | recommended | Obtained during OAuth consent |
| `DIRECTOR_EMAIL` | – | CC on salary emails |
| `FOUNDING_TRAINER_EMAIL` | – | CC on salary emails |
| `ACCOUNTANT_EMAIL` | – | BCC on salary emails |
| `BACKEND_URL` | – | Public backend URL (for links in emails / Slack) |
| `ADMIN_DASHBOARD_URL` | – | Public admin URL |
| `BSC_FORM_URL` | – | Public BSC form URL |
| `SALARY_CRON_SCHEDULE` | – | Cron expression; default `0 9 28 * *` |
| `BSC_CRON_SCHEDULE` | – | Cron expression; default `0 8 31 3,6,9,12 *` |

**Frontend `.env` files** (one per React app):

| File | Variable | Value |
|------|----------|-------|
| `packages/admin-dashboard/.env` | `VITE_API_URL` | `https://<backend>/api` |
| `packages/bsc-form/.env` | `VITE_API_URL` | `https://<backend>/api` |

---

## How the Pieces Talk to Each Other

```
Trainers (Slack)                  Arnav / Director (browser)
     │                                      │
     ▼                                      ▼
┌─────────────┐               ┌─────────────────────┐
│  Slack Bot  │               │   Admin Dashboard   │  ← Vercel
│ (Socket Mode│               │   (React + Vite)    │
│  – no URL   │               └──────────┬──────────┘
│  needed)    │                          │  HTTPS + JWT
└──────┬──────┘                          │
       │  WebSocket                      │
       ▼                                 ▼
┌──────────────────────────────────────────────┐
│          Backend  (single Node.js process)   │  ← VPS / Railway
│                                              │
│  • Express  → REST API  (trainers, bsc, …)   │
│  • Bolt     → Slack events / commands        │
│  • node-cron → 28th 9 AM salary generation   │
│              → quarter-end BSC reminders     │
│  • Puppeteer→ generates salary PDFs          │
│  • Gmail    → creates drafts via OAuth       │
└───────────────────┬──────────────────────────┘
                    │
                    ▼
         ┌──────────────────┐
         │  MongoDB Atlas   │  ← managed cloud DB
         │  trainers        │
         │  bsc_entries     │
         │  salary_statements│
         │  audit_logs      │
         └──────────────────┘

┌─────────────────────┐
│   BSC Form          │  ← Vercel (separate deployment)
│   (React + Vite)    │
│   bsc.redmat.com    │
│   hits same API     │
└─────────────────────┘
```

---

## First-Run Checklist (after deploying)

1. **Seed trainers** – use the API or the admin dashboard's "+ Add Trainer" to add each trainer with their Slack user ID, salary, and scorecard metrics.
2. **Test salary generation** – hit the "⚙ Generate" button in the Salary page for the current month with one trainer.  Verify the PDF downloads and the Gmail draft appears in your inbox.
3. **Test BSC flow** – open `bsc.redmat.com/<trainerId>` in a browser.  Submit the form.  Then go to the admin dashboard's "BSC Review" tab and validate it.
4. **Verify Slack** – have a trainer open the Red Mat app in Slack.  Their home tab should show the salary breakdown.
5. **Enable cron** – salary generation fires automatically on the 28th.  To test early, temporarily set `SALARY_CRON_SCHEDULE=*/2 * * * *` (every 2 min), watch the console, then change it back.
6. **Lock MongoDB Network Access** – replace `0.0.0.0/0` with your VPS public IP.

---

## Cost Estimate (production)

| Service | Tier | $/month |
|---------|------|---------|
| MongoDB Atlas | M0 (free) or M10 | 0 – 9 |
| DigitalOcean Droplet | Basic $6 | 6 |
| Vercel (×2 apps) | Free tier | 0 |
| Google Cloud (Gmail API) | Free quota | 0 |

Total: **$6 – $15 / month**.

---

## License

ISC – Red Mat Pilates

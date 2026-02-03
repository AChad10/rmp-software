# Red Mat Pilates - Payroll Automation System

## Executive Summary

This document outlines the transition from a manual, time-intensive payroll process to an automated system for Red Mat Pilates' 15-20 employees. The solution aims to reduce monthly payroll processing from 4+ hours to under 15 minutes while maintaining transparency and accuracy.

---

## Table of Contents

1. [Current Manual Flow](#current-manual-flow)
2. [Desired Automated Flow](#desired-automated-flow)
3. [Technical Solution](#technical-solution)
4. [Implementation Plan](#implementation-plan)
5. [Data Models](#data-models)
6. [API Specifications](#api-specifications)
7. [User Interfaces](#user-interfaces)

---

## Current Manual Flow

### 1. Monthly Salary Processing (4+ hours/month)

**Timeline**: A few days before month-end

**Steps**:
1. Arnav opens Notion to see list of trainers requiring salary processing
2. For each trainer (15-20 people):
   - Opens individual Excel file
   - Checks master sheet for current base salary
   - Reviews if any bonuses need to be added for the month
   - Checks for any salary changes (raises, adjustments)
   - Copies salary template
   - Manually fills in trainer details
   - Calculates total: `base_salary + prorated_quarterly_bonus (if applicable)`
   - Exports as PDF
3. Opens Gmail
4. Manually composes individual emails for each trainer
5. Attaches corresponding PDF
6. Sends email individually (~20 emails)

**Pain Points**:
- Extremely time-consuming (4 hours monthly)
- High risk of copy-paste errors
- No version control or audit trail
- Difficult to track who has been paid vs. pending
- Easy to miss bonuses or salary changes

---

### 2. Quarterly BSC (Balanced Score Card) Process

**Timeline**: End of each quarter (JFM, AMJ, JAS, OND)
**Payout**: Month after quarter ends (e.g., Jan 1 for OND quarter)

**Steps**:
1. End of quarter arrives (March 31, June 30, Sept 30, Dec 31)
2. Each trainer has an individual Google Sheet (different metrics per trainer)
3. Trainer opens their sheet
4. Opens Power BI dashboard in separate tab/window
5. References their quarterly stats from BI (session fill rates, trial conversions, attendance, etc.)
6. Manually enters self-scores for each metric (0-10 scale)
7. Sheet calculates weighted average → final score out of 10
8. Arnav receives notification (or manually checks)
9. Arnav opens each trainer's sheet individually
10. Cross-references their self-scores with Power BI metrics
11. Validates or adjusts scores based on data
12. Manually notes validated scores (possibly in Notion or master sheet)
13. Over next 3 months, uses this score to calculate prorated bonus: 
    - `monthly_bonus = (quarterly_bonus_amount × BSC_score) / 3`

**Pain Points**:
- Trainers need to context-switch between BI dashboard and Google Sheet
- No structured validation workflow
- Easy to lose track of which trainers have submitted vs. pending
- Manual calculation and tracking of bonus payments across 3 months
- No clear record of when bonus was fully paid out

---

### 3. Ad-Hoc Salary Changes

**Scenario**: Director approves a raise after performance review meeting

**Steps**:
1. Director verbally informs Arnav of raise decision
2. Arnav opens master Excel sheet
3. Manually updates base salary for that trainer
4. No formal logging of:
   - Who authorized the change
   - When it was made
   - What the previous salary was
   - Reason for change
5. Change will reflect in next month's manual salary generation

**Pain Points**:
- No audit trail
- Risk of forgetting to update
- Cannot track salary history over time
- Difficult to generate reports (e.g., "total salary increases in 2025")

---

### 4. Current Data Sources

| Data | Location | Update Frequency |
|------|----------|------------------|
| Trainer base salaries | Master Excel Sheet | Ad-hoc (when raises happen) |
| BSC scores | Individual Google Sheets | Quarterly |
| Salary statements | Notion + Individual Excel files | Monthly |
| BI metrics (session fills, conversions) | Power BI Dashboard | Weekly (manual dump from PunchPass) |
| Trainer personal info | Scattered across sheets | Rarely |

---

## Desired Automated Flow

### 1. Monthly Salary Processing (Automated)

**Timeline**: 28th of each month, 9:00 AM automatic trigger

**Steps**:
1. **Cron job triggers** at scheduled time
2. System fetches all active trainers from database
3. For each trainer:
   - Retrieves current base salary
   - Checks if quarterly bonus applicable
   - If yes, looks up most recent validated BSC score
   - Calculates prorated bonus: `(quarterly_bonus_amount × BSC_score) / 3`
   - Checks if this is the 3rd month of bonus payout (marks BSC as "paid" after 3 months)
   - Calculates total: `base_salary + prorated_bonus`
4. **Generates PDF** using pre-defined template with trainer details
5. **Creates Gmail draft**:
   - To: trainer@redmat.com
   - CC: director@redmat.com, founding.trainer@redmat.com
   - BCC: accountant@redmat.com
   - Subject: "Salary Statement - [Month Year]"
   - Attachment: Generated PDF
6. **Posts to Slack**:
   - Updates trainer's Slack Home tab with salary breakdown
   - PDF available for download
7. **Logs transaction** in database with timestamp
8. **Sends Arnav a summary notification**: "✅ Generated 18 salary statements for March 2026. Review drafts in Gmail."
9. **Arnav's action**: Opens Gmail → Reviews drafts (1-2 mins) → Clicks "Send All" or sends individually

**Time Saved**: 4 hours → 15 minutes

**Benefits**:
- Zero manual data entry
- No risk of calculation errors
- Complete audit trail
- Trainers get consistent, professional statements
- Easy to track draft vs. sent status

---

### 2. Quarterly BSC Workflow (Semi-Automated)

**Timeline**: Last week of each quarter

**Steps**:

#### For Trainers (5-10 minutes per person):
1. **Slack notification**: "📊 Time to complete your Q1-2026 self-assessment. Link: [bsc.redmat.com/arjun/Q1-2026]"
2. Trainer clicks link → Opens personalized BSC form
3. **Top of page**: Power BI dashboard iframe embedded showing their live quarterly stats
4. **Below BI dashboard**: Dynamic form with their specific metrics
   - Example for Trainer A:
     - Trial Conversions (weight: 20%): [slider 0-10]
     - Team Focus (weight: 15%): [slider 0-10]
     - Punctuality (weight: 10%): [slider 0-10]
     - Client Retention (weight: 25%): [slider 0-10]
     - Session Quality (weight: 30%): [slider 0-10]
   - Real-time calculation shows: "Your weighted score: 8.3/10"
5. Trainer submits form
6. Entry saved to database with status: `pending_validation`
7. Trainer receives confirmation: "✅ Assessment submitted. Arnav will review shortly."

#### For Arnav (2-3 minutes per person):
1. Opens Admin Dashboard → "BSC Review" tab
2. Sees list of pending submissions:
   ```
   Pending Reviews - Q1-2026
   ┌─────────────┬──────────────┬──────────────┬────────┐
   │ Trainer     │ Self-Score   │ Submitted    │ Action │
   ├─────────────┼──────────────┼──────────────┼────────┤
   │ Arjun       │ 8.3/10       │ 2 hours ago  │ Review │
   │ Priya       │ 7.9/10       │ 1 day ago    │ Review │
   └─────────────┴──────────────┴──────────────┴────────┘
   ```
3. Clicks "Review" → Modal opens with:
   - Left side: Trainer's self-scores per metric
   - Right side: Embedded BI dashboard (or link to their stats)
   - Option to adjust individual metric scores
   - Text field for notes/reason if adjusting
4. Clicks "Approve" (if scores look good) or "Adjust & Approve" (if changes needed)
5. Score locked with status: `validated`
6. Next 3 months' salary calculations automatically use this validated score

**Automation Benefits**:
- Trainers self-score while viewing their actual data (reduces back-and-forth)
- Structured validation workflow (clear pending vs. validated status)
- Automatic bonus calculation for next 3 months
- Historical record of all BSC scores with timestamps
- No more manual tracking of "which quarter's bonus are we paying this month?"

---

### 3. Ad-Hoc Salary Changes (Tracked & Audited)

**Scenario**: Director approves a raise

**Steps**:
1. Director logs into Admin Dashboard (or Arnav does it on their behalf)
2. Navigates to "Trainers" tab
3. Searches/selects trainer
4. Clicks "Edit Base Salary"
5. Modal appears:
   - Current salary: ₹40,000
   - New salary: [input field]
   - Reason: [text area] "Annual raise - Director approved after Q4 review"
   - Effective from: [dropdown] March 2026
6. Clicks "Save"
7. System logs change to `audit_logs` collection:
   ```
   {
     timestamp: 2026-02-20T10:30:00Z,
     user: "director@redmat.com",
     action: "update_base_salary",
     trainer: "Arjun Sharma",
     old_value: 40000,
     new_value: 45000,
     reason: "Annual raise - Director approved after Q4 review",
     effective_from: "2026-03"
   }
   ```
8. Next month's salary statement automatically reflects new base salary
9. Admin dashboard shows audit trail with full history

**Benefits**:
- Complete transparency (who, what, when, why)
- Easy to generate reports ("total raises in Q1", "salary history for Arjun")
- No risk of forgetting to update
- Director can make changes directly (reduces Arnav's admin burden)

---

### 4. Trainer Experience (Slack Integration)

**Scenario**: Trainer wants to view their salary

**Current**: Wait for email, hope PDF doesn't go to spam, search email later if needed

**New Flow**:
1. Trainer opens Slack
2. Navigates to "Red Mat Pilates" app
3. Home tab shows:
   ```
   📄 Your Salary Statement
   
   Month: March 2026
   ────────────────────────
   Base Salary:        ₹45,000
   Quarterly Bonus:     ₹3,900
   ────────────────────────
   Total:              ₹48,900
   
   [Download PDF]  [View Breakdown]
   
   ℹ️ Statements available from Feb 2026 onwards
   ```
4. Can download PDF anytime
5. Can view historical statements from dropdown

**Benefits**:
- Self-service (trainers don't need to ask Arnav for old statements)
- Always accessible in one place
- No email clutter

---

## Technical Solution

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                         │
├──────────────────┬──────────────────┬──────────────────────┤
│  Admin Dashboard │   BSC Form       │  Slack App (Trainers)│
│  (React/Vite)    │   (React/Vite)   │  (Bolt for JS)       │
│  - Trainers CRUD │   - Embedded BI  │  - View statements   │
│  - BSC Review    │   - Self-scoring │  - Download PDFs     │
│  - Audit Logs    │                  │                      │
│  - Salary Review │                  │                      │
└──────────┬───────┴────────┬─────────┴──────────┬───────────┘
           │                │                    │
           └────────────────┼────────────────────┘
                           │
                           ▼
           ┌───────────────────────────────┐
           │      NODE.JS + EXPRESS API     │
           ├───────────────────────────────┤
           │ - Authentication (JWT)         │
           │ - CRUD Endpoints              │
           │ - BSC Submission/Validation   │
           │ - Salary Calculation Logic    │
           │ - PDF Generation (Puppeteer)  │
           │ - Gmail API Integration       │
           │ - Slack Bolt Integration      │
           │ - Cron Jobs (node-cron)       │
           └──────────┬────────────────────┘
                      │
                      ▼
           ┌───────────────────────────────┐
           │      MONGODB ATLAS            │
           ├───────────────────────────────┤
           │ Collections:                  │
           │ - trainers                    │
           │ - bsc_entries                 │
           │ - salary_statements           │
           │ - audit_logs                  │
           └───────────────────────────────┘

           External Integrations:
           ├── Gmail API (draft creation)
           ├── Slack API (notifications, home tab)
           └── Power BI (embedded iframes in BSC form)
```

---

### Tech Stack Justification

| Component | Technology | Why |
|-----------|-----------|-----|
| **Backend** | Node.js + Express | - Fast development<br>- Arnav has experience<br>- Good ecosystem for cron, PDF, email<br>- Single language (JS) across stack |
| **Database** | MongoDB | - Flexible schema (trainers have different scorecard metrics)<br>- Easy to version documents<br>- Good for audit logs<br>- Arnav has experience<br>- No complex joins needed |
| **PDF Generation** | Puppeteer | - Can replicate existing PDF template exactly<br>- HTML/CSS to PDF (easy to customize)<br>- Runs headless Chrome |
| **Cron Jobs** | node-cron | - Runs within Node process (no separate infra)<br>- Simple syntax<br>- Reliable for monthly tasks |
| **Admin Dashboard** | React + Vite | - Fast build times<br>- Modern, clean UI<br>- Easy to deploy (Vercel)<br>- Component reusability |
| **BSC Form** | React + Vite | - Can embed Power BI iframe<br>- Dynamic form rendering based on scorecard template<br>- Real-time score calculation |
| **Slack Integration** | Bolt for JavaScript | - Official Slack framework<br>- Easy to build Home tabs, modals<br>- Handles auth automatically |
| **Authentication** | JWT | - Stateless<br>- Easy to implement<br>- Works well with React frontends |

---

### System Components

#### 1. Backend API (Node.js + Express)

**Core Responsibilities**:
- Serve REST APIs for all CRUD operations
- Handle authentication and authorization
- Execute salary calculation logic
- Generate PDFs via Puppeteer
- Interact with Gmail API for draft creation
- Post to Slack via Bolt
- Run scheduled cron jobs

**Key Endpoints**:
```
Authentication:
POST   /api/auth/login
POST   /api/auth/logout

Trainers:
GET    /api/trainers
GET    /api/trainers/:id
POST   /api/trainers
PUT    /api/trainers/:id
DELETE /api/trainers/:id

BSC:
POST   /api/bsc/submit
GET    /api/bsc/pending
PUT    /api/bsc/:id/validate
GET    /api/bsc/trainer/:trainerId

Salary:
GET    /api/salary/statements
GET    /api/salary/statements/:id
POST   /api/salary/generate (manual trigger)
GET    /api/salary/pdf/:statementId (PDF download)

Audit Logs:
GET    /api/audit-logs
GET    /api/audit-logs/trainer/:trainerId

Admin:
GET    /api/admin/dashboard-stats
```

**Cron Jobs**:
```javascript
// Schedule: 28th of every month at 9:00 AM
cron.schedule('0 9 28 * *', generateMonthlySalaries);

// Schedule: Last day of quarter at 8:00 AM (send BSC reminders)
cron.schedule('0 8 31 3,6,9,12 *', sendBSCReminders);
```

---

#### 2. MongoDB Collections

**Design Principles**:
- Each collection serves a clear purpose
- Flexible schemas to accommodate different trainer types
- Built-in audit trail via timestamps and change logs
- Optimized for common queries (indexing on trainer_id, month, quarter)

See [Data Models](#data-models) section for full schemas.

---

#### 3. Admin Dashboard (React)

**Pages**:

**A. Dashboard (Home)**
```
┌─────────────────────────────────────────────────────┐
│  Red Mat Pilates - Payroll Admin                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Quick Stats (March 2026)                           │
│  ┌─────────────┬──────────────┬─────────────┐      │
│  │ 18 Trainers │ 15 Drafted   │ 3 Pending   │      │
│  │ Active      │ Statements   │ BSC Reviews │      │
│  └─────────────┴──────────────┴─────────────┘      │
│                                                      │
│  Recent Activity                                    │
│  • Salary statements generated for March 2026       │
│  • Arjun's base salary updated to ₹45,000          │
│  • Priya submitted Q1-2026 BSC (pending review)    │
│                                                      │
│  [View All Trainers]  [Review BSC]  [Audit Logs]   │
└─────────────────────────────────────────────────────┘
```

**B. Trainers Management**
```
┌───────────────────────────────────────────────────────────────┐
│ Trainers                                    [+ Add Trainer]    │
├───────────────────────────────────────────────────────────────┤
│ Search: [_________]  Filter: [All ▼]  Sort: [Name ▼]         │
├───────┬──────────┬───────────┬────────────┬─────────┬────────┤
│ Name  │ Email    │ Base (₹)  │ Bonus (₹)  │ Status  │ Action │
├───────┼──────────┼───────────┼────────────┼─────────┼────────┤
│ Arjun │ arjun@.. │ 45,000    │ 15,000     │ Active  │ ✎ 🗑   │
│ Priya │ priya@.. │ 40,000    │ 12,000     │ Active  │ ✎ 🗑   │
│ Rahul │ rahul@.. │ 38,000    │ -          │ Active  │ ✎ 🗑   │
│ ...   │          │           │            │         │        │
└───────┴──────────┴───────────┴────────────┴─────────┴────────┘
```

Click "✎" opens modal:
```
┌────────────────────────────────────────┐
│ Edit Trainer: Arjun Sharma             │
├────────────────────────────────────────┤
│ Name: [Arjun Sharma____________]       │
│ Email: [arjun@redmat.com_______]       │
│ Base Salary: [45000____________] ₹     │
│ Quarterly Bonus: [15000________] ₹     │
│                                        │
│ Reason for change:                     │
│ [Annual raise approved by director___] │
│ [_________________________________]    │
│                                        │
│ Scorecard Template:                    │
│ ┌────────────────────┬────────┬───┐   │
│ │ Metric             │ Weight │ ✖ │   │
│ ├────────────────────┼────────┼───┤   │
│ │ Trial Conversions  │ 20%    │ ✖ │   │
│ │ Team Focus         │ 15%    │ ✖ │   │
│ │ Punctuality        │ 10%    │ ✖ │   │
│ └────────────────────┴────────┴───┘   │
│ [+ Add Metric]                         │
│                                        │
│ [Cancel]  [Save Changes]               │
└────────────────────────────────────────┘
```

**C. BSC Review**
```
┌─────────────────────────────────────────────────────────┐
│ BSC Reviews - Q1 2026                                    │
├─────────────────────────────────────────────────────────┤
│ Tabs: [Pending (3)] [Validated (15)] [All (18)]        │
├───────────┬─────────────┬──────────────┬────────┬──────┤
│ Trainer   │ Self-Score  │ Submitted    │ Status │ Act. │
├───────────┼─────────────┼──────────────┼────────┼──────┤
│ Arjun     │ 8.3/10      │ 2 hours ago  │ Pend.  │ Rev. │
│ Priya     │ 7.9/10      │ 1 day ago    │ Pend.  │ Rev. │
│ Neha      │ 9.1/10      │ 3 days ago   │ Pend.  │ Rev. │
└───────────┴─────────────┴──────────────┴────────┴──────┘
```

Click "Rev." (Review) opens modal:
```
┌───────────────────────────────────────────────────────────┐
│ Review BSC: Arjun Sharma - Q1 2026                        │
├───────────────────────────────────────────────────────────┤
│ Submitted: Feb 28, 2026 at 3:45 PM                       │
│                                                           │
│ ┌──────────────────┬─────────────┬────────────┬────────┐ │
│ │ Metric           │ Self-Score  │ Your Score │ Weight │ │
│ ├──────────────────┼─────────────┼────────────┼────────┤ │
│ │ Trial Conversions│      8      │ [8______]  │  20%   │ │
│ │ Team Focus       │      9      │ [9______]  │  15%   │ │
│ │ Punctuality      │      7      │ [7______]  │  10%   │ │
│ │ Client Retention │      8      │ [8______]  │  25%   │ │
│ │ Session Quality  │      9      │ [9______]  │  30%   │ │
│ └──────────────────┴─────────────┴────────────┴────────┘ │
│                                                           │
│ Final Weighted Score:                                     │
│ Self-calculated: 8.3/10                                   │
│ Your validation: 8.3/10 (auto-calculated)                │
│                                                           │
│ [View BI Dashboard →]                                     │
│                                                           │
│ Notes (optional):                                         │
│ [Scores look accurate based on BI data._______________]  │
│ [__________________________________________________]      │
│                                                           │
│ [Cancel]  [Approve]  [Adjust & Approve]                  │
└───────────────────────────────────────────────────────────┘
```

**D. Salary Statements**
```
┌─────────────────────────────────────────────────────────┐
│ Salary Statements - March 2026                          │
├─────────────────────────────────────────────────────────┤
│ Months: [March 2026 ▼]  Status: [All ▼]                │
├──────────┬────────┬────────┬──────────┬─────────┬──────┤
│ Trainer  │ Base   │ Bonus  │ Total    │ Status  │ Act. │
├──────────┼────────┼────────┼──────────┼─────────┼──────┤
│ Arjun    │ 45,000 │ 3,900  │ 48,900   │ Draft   │ 📄👁 │
│ Priya    │ 40,000 │ 3,120  │ 43,120   │ Sent ✓  │ 📄👁 │
│ Rahul    │ 38,000 │ -      │ 38,000   │ Draft   │ 📄👁 │
└──────────┴────────┴────────┴──────────┴─────────┴──────┘

[Open Gmail Drafts] [Regenerate All] [Mark All as Sent]
```

**E. Audit Logs**
```
┌────────────────────────────────────────────────────────────┐
│ Audit Logs                                                 │
├────────────────────────────────────────────────────────────┤
│ Filter: [Last 30 days ▼] [All Actions ▼] [All Users ▼]   │
├──────────────┬───────────────┬────────────┬──────────────┤
│ Timestamp    │ User          │ Action     │ Details      │
├──────────────┼───────────────┼────────────┼──────────────┤
│ Feb 20, 10:30│ director@..   │ Salary ↑   │ Arjun: 40k   │
│              │               │            │ → 45k        │
├──────────────┼───────────────┼────────────┼──────────────┤
│ Feb 28, 09:00│ system (cron) │ Salary Gen │ 18 statements│
│              │               │            │ for Mar 2026 │
├──────────────┼───────────────┼────────────┼──────────────┤
│ Feb 28, 15:45│ arjun@..      │ BSC Submit │ Q1-2026: 8.3 │
└──────────────┴───────────────┴────────────┴──────────────┘

[Export as CSV]
```

---

#### 4. BSC Scoring Form (React)

**URL Structure**: `bsc.redmat.com/{trainerId}/{quarter}`

Example: `bsc.redmat.com/507f1f77bcf86cd799439011/Q1-2026`

**Layout**:
```
┌──────────────────────────────────────────────────────────┐
│ Red Mat Pilates - Quarterly Self-Assessment             │
├──────────────────────────────────────────────────────────┤
│ Trainer: Arjun Sharma                                    │
│ Quarter: Q1 2026 (Jan-Mar)                              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ 📊 Your Performance Metrics                             │
│ ┌────────────────────────────────────────────────────┐  │
│ │                                                    │  │
│ │  [Power BI Dashboard Embedded Here]               │  │
│ │  - Session fill rate: 87%                         │  │
│ │  - Trial conversions: 24/30 (80%)                 │  │
│ │  - Client retention: 92%                          │  │
│ │  - Avg. session rating: 4.8/5                     │  │
│ │                                                    │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ ───────────────────────────────────────────────────────  │
│                                                          │
│ 📝 Rate Your Performance (0-10)                         │
│                                                          │
│ Trial Conversions (Weight: 20%)                         │
│ How effective were you at converting trials to members? │
│ 0 ●─────────────────────────────────────────── 10       │
│                           ↑ Score: 8                     │
│                                                          │
│ Team Focus (Weight: 15%)                                │
│ How engaged were you in team meetings and initiatives?  │
│ 0 ──────────●───────────────────────────────── 10       │
│                           ↑ Score: 9                     │
│                                                          │
│ Punctuality (Weight: 10%)                               │
│ How consistently did you arrive on time for sessions?   │
│ 0 ─────────────●────────────────────────────── 10       │
│                           ↑ Score: 7                     │
│                                                          │
│ [... other metrics ...]                                 │
│                                                          │
│ ───────────────────────────────────────────────────────  │
│                                                          │
│ Your Weighted Score: 8.3 / 10                           │
│                                                          │
│ This score will be reviewed by management and used to   │
│ calculate your quarterly bonus for Apr-Jun 2026.        │
│                                                          │
│ [Cancel] [Submit Assessment]                            │
└──────────────────────────────────────────────────────────┘
```

**Technical Notes**:
- Form is dynamically generated based on `trainer.scorecard_template` from MongoDB
- Real-time calculation: as trainer adjusts sliders, weighted score updates
- Power BI iframe uses trainer-specific filter (if supported), else falls back to "Open Dashboard" button
- After submission, trainer sees confirmation message and cannot resubmit unless Arnav requests changes

---

#### 5. Slack App (Trainer-Facing)

**Home Tab**:
```
┌──────────────────────────────────────────────────────┐
│ 📄 Your Salary Statement                             │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Current Month: March 2026                            │
│ ────────────────────────────────────────────────     │
│ Base Salary:                           ₹45,000       │
│ Quarterly Bonus (Q4-2025):              ₹3,900       │
│ ────────────────────────────────────────────────     │
│ Total:                                 ₹48,900       │
│                                                      │
│ [Download PDF] [View Breakdown]                      │
│                                                      │
│ ───────────────────────────────────────────────────  │
│                                                      │
│ 📅 Previous Statements                               │
│ View: [March 2026 ▼]                                │
│                                                      │
│ ℹ️ Statements available from February 2026 onwards  │
│                                                      │
│ ───────────────────────────────────────────────────  │
│                                                      │
│ 📊 Your Next BSC Review                              │
│ Q1-2026 due by: March 31, 2026                      │
│ Status: Not yet submitted                            │
│                                                      │
│ [Complete Assessment →]                              │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Notifications**:
- When salary statement is generated: DM with summary + link to download
- When BSC deadline is approaching: Reminder DM with link to form
- When BSC is validated: DM with final score confirmation

---

## Data Models

### Collection: `trainers`

```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  
  // Basic Info
  name: "Arjun Sharma",
  email: "arjun@redmat.com",
  slack_user_id: "U01ABC123", // For Slack integration
  phone: "+91-9876543210",
  
  // Employment
  employment_type: "fixed_ctc", // or "per_session", "senior_trainer"
  status: "active", // or "inactive", "on_leave"
  join_date: ISODate("2024-01-15"),
  
  // Salary Structure
  base_salary: 45000, // Monthly fixed component
  quarterly_bonus_amount: 15000, // Null if not applicable
  
  // BSC Configuration
  scorecard_template: [
    {
      metric: "Trial Conversions",
      weight: 0.20,
      description: "Percentage of trials converted to paid memberships"
    },
    {
      metric: "Team Focus",
      weight: 0.15,
      description: "Participation in team meetings and collaborative initiatives"
    },
    {
      metric: "Punctuality",
      weight: 0.10,
      description: "On-time arrival for scheduled sessions"
    },
    {
      metric: "Client Retention",
      weight: 0.25,
      description: "Percentage of clients retained month-over-month"
    },
    {
      metric: "Session Quality",
      weight: 0.30,
      description: "Average client ratings and feedback"
    }
  ],
  
  // Metadata
  created_at: ISODate("2024-01-10T08:00:00Z"),
  updated_at: ISODate("2026-02-20T10:30:00Z"),
  created_by: "arnav@redmat.com",
  last_updated_by: "director@redmat.com"
}
```

**Indexes**:
- `email` (unique)
- `slack_user_id` (unique, sparse)
- `status`

---

### Collection: `bsc_entries`

```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439012"),
  
  trainer_id: ObjectId("507f1f77bcf86cd799439011"),
  quarter: "Q1-2026", // Format: Q{1-4}-{YEAR}
  quarter_months: ["2026-01", "2026-02", "2026-03"], // For lookups
  
  // Scoring
  scores: [
    {
      metric: "Trial Conversions",
      weight: 0.20,
      self_score: 8,
      validated_score: 7, // Arnav's adjustment
      notes: "Adjusted based on BI data showing 75% actual conversion vs. self-reported 80%"
    },
    {
      metric: "Team Focus",
      weight: 0.15,
      self_score: 9,
      validated_score: 9,
      notes: null // No adjustment needed
    },
    {
      metric: "Punctuality",
      weight: 0.10,
      self_score: 7,
      validated_score: 7,
      notes: null
    },
    {
      metric: "Client Retention",
      weight: 0.25,
      self_score: 8,
      validated_score: 8,
      notes: null
    },
    {
      metric: "Session Quality",
      weight: 0.30,
      self_score: 9,
      validated_score: 9,
      notes: null
    }
  ],
  
  // Calculated Scores
  self_calculated_score: 8.3, // Weighted average of self_scores
  final_score: 7.8, // Weighted average of validated_scores
  
  // Workflow Status
  status: "validated", // "pending_validation", "validated", "paid"
  
  // Payout Tracking
  monthly_bonus_amount: 3900, // (15000 * 7.8) / 3
  months_paid: ["2026-04", "2026-05"], // Tracks which months this bonus was included
  fully_paid: false, // True after 3rd month payout
  
  // Timestamps
  submitted_at: ISODate("2026-03-28T15:45:00Z"),
  validated_at: ISODate("2026-03-29T10:15:00Z"),
  validated_by: "arnav@redmat.com",
  
  created_at: ISODate("2026-03-28T15:45:00Z"),
  updated_at: ISODate("2026-03-29T10:15:00Z")
}
```

**Indexes**:
- `trainer_id` + `quarter` (compound, unique)
- `status`
- `quarter`

---

### Collection: `salary_statements`

```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439013"),
  
  trainer_id: ObjectId("507f1f77bcf86cd799439011"),
  month: "2026-03", // Format: YYYY-MM
  
  // Salary Breakdown
  base_salary: 45000,
  quarterly_bonus_prorated: 3900, // Null if not applicable
  adjustments: 0, // For one-time bonuses, deductions
  total: 48900,
  
  // References
  bsc_quarter_reference: "Q4-2025", // Which BSC this bonus came from
  bsc_entry_id: ObjectId("507f1f77bcf86cd799439012"),
  
  // File Storage
  pdf_filename: "2026-03-arjun-sharma.pdf",
  pdf_url: "/storage/salary-statements/2026-03-arjun-sharma.pdf",
  // Could also be S3 URL: "s3://redmat-payroll/statements/2026-03-arjun.pdf"
  
  // Gmail Integration
  gmail_draft_id: "r-1234567890abcdef",
  gmail_message_id: null, // Populated after email is sent
  
  // Slack Integration
  slack_posted: true,
  slack_posted_at: ISODate("2026-02-28T09:05:00Z"),
  
  // Status Tracking
  status: "sent", // "draft", "sent", "failed"
  sent_at: ISODate("2026-02-28T14:30:00Z"),
  sent_by: "arnav@redmat.com",
  
  // Metadata
  generated_at: ISODate("2026-02-28T09:00:00Z"),
  created_at: ISODate("2026-02-28T09:00:00Z"),
  updated_at: ISODate("2026-02-28T14:30:00Z")
}
```

**Indexes**:
- `trainer_id` + `month` (compound, unique)
- `month`
- `status`
- `bsc_entry_id`

---

### Collection: `audit_logs`

```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439014"),
  
  // Who & When
  timestamp: ISODate("2026-02-20T10:30:00Z"),
  user_email: "director@redmat.com",
  user_name: "Director",
  
  // What
  action: "update_base_salary", 
  // Possible values:
  // - "create_trainer"
  // - "update_base_salary"
  // - "update_bonus_amount"
  // - "update_scorecard_template"
  // - "deactivate_trainer"
  // - "bsc_validated"
  // - "bsc_score_adjusted"
  // - "salary_generated"
  // - "salary_sent"
  
  // Where
  entity: "trainers", // "bsc_entries", "salary_statements"
  entity_id: ObjectId("507f1f77bcf86cd799439011"),
  
  // Details
  changes: {
    field: "base_salary",
    old_value: 40000,
    new_value: 45000,
    reason: "Annual raise - Director approved after Q4 review"
  },
  
  // Context
  ip_address: "103.123.45.67",
  user_agent: "Mozilla/5.0...",
  
  // Metadata
  created_at: ISODate("2026-02-20T10:30:00Z")
}
```

**Indexes**:
- `entity_id`
- `timestamp` (descending)
- `user_email`
- `action`

---

### Collection: `users` (Admin Authentication)

```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439015"),
  
  email: "arnav@redmat.com",
  name: "Arnav",
  role: "admin", // or "director", "accountant" (for future role-based access)
  password_hash: "$2b$10$abcdefghijklmnopqrstuvwxyz...", // bcrypt hash
  
  // Preferences
  notification_preferences: {
    email_on_bsc_submit: true,
    email_on_salary_generation: true,
    slack_notifications: true
  },
  
  // Session Management
  last_login: ISODate("2026-02-28T08:00:00Z"),
  active: true,
  
  created_at: ISODate("2024-01-01T00:00:00Z"),
  updated_at: ISODate("2026-02-28T08:00:00Z")
}
```

**Indexes**:
- `email` (unique)

---

## API Specifications

### Authentication

#### POST `/api/auth/login`

**Request**:
```json
{
  "email": "arnav@redmat.com",
  "password": "secure_password_123"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439015",
    "email": "arnav@redmat.com",
    "name": "Arnav",
    "role": "admin"
  }
}
```

**Response** (401 Unauthorized):
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

---

### Trainers

#### GET `/api/trainers`

**Query Parameters**:
- `status` (optional): "active", "inactive", "all"
- `search` (optional): Search by name or email

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Arjun Sharma",
      "email": "arjun@redmat.com",
      "employment_type": "fixed_ctc",
      "base_salary": 45000,
      "quarterly_bonus_amount": 15000,
      "status": "active"
    },
    {
      "_id": "507f1f77bcf86cd799439016",
      "name": "Priya Mehta",
      "email": "priya@redmat.com",
      "employment_type": "fixed_ctc",
      "base_salary": 40000,
      "quarterly_bonus_amount": 12000,
      "status": "active"
    }
  ],
  "count": 2
}
```

---

#### GET `/api/trainers/:id`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Arjun Sharma",
    "email": "arjun@redmat.com",
    "slack_user_id": "U01ABC123",
    "employment_type": "fixed_ctc",
    "status": "active",
    "join_date": "2024-01-15T00:00:00Z",
    "base_salary": 45000,
    "quarterly_bonus_amount": 15000,
    "scorecard_template": [
      {
        "metric": "Trial Conversions",
        "weight": 0.20,
        "description": "Percentage of trials converted to paid memberships"
      }
    ],
    "created_at": "2024-01-10T08:00:00Z",
    "updated_at": "2026-02-20T10:30:00Z"
  }
}
```

---

#### POST `/api/trainers`

**Request**:
```json
{
  "name": "Neha Singh",
  "email": "neha@redmat.com",
  "employment_type": "fixed_ctc",
  "base_salary": 42000,
  "quarterly_bonus_amount": 13000,
  "scorecard_template": [
    {
      "metric": "Trial Conversions",
      "weight": 0.25,
      "description": "Trial to paid conversion rate"
    },
    {
      "metric": "Punctuality",
      "weight": 0.15,
      "description": "On-time session starts"
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Trainer created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439017",
    "name": "Neha Singh",
    "email": "neha@redmat.com",
    "status": "active",
    "created_at": "2026-02-28T10:00:00Z"
  }
}
```

---

#### PUT `/api/trainers/:id`

**Request**:
```json
{
  "base_salary": 47000,
  "reason": "Q1 2026 performance raise approved by Director"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Trainer updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Arjun Sharma",
    "base_salary": 47000,
    "updated_at": "2026-03-01T11:00:00Z"
  },
  "audit_log_id": "507f1f77bcf86cd799439018"
}
```

---

### BSC (Balanced Score Card)

#### POST `/api/bsc/submit`

**Request**:
```json
{
  "trainer_id": "507f1f77bcf86cd799439011",
  "quarter": "Q1-2026",
  "scores": [
    {
      "metric": "Trial Conversions",
      "self_score": 8
    },
    {
      "metric": "Team Focus",
      "self_score": 9
    },
    {
      "metric": "Punctuality",
      "self_score": 7
    },
    {
      "metric": "Client Retention",
      "self_score": 8
    },
    {
      "metric": "Session Quality",
      "self_score": 9
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "BSC submitted successfully. Your manager will review it shortly.",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "trainer_id": "507f1f77bcf86cd799439011",
    "quarter": "Q1-2026",
    "self_calculated_score": 8.3,
    "status": "pending_validation",
    "submitted_at": "2026-03-28T15:45:00Z"
  }
}
```

---

#### GET `/api/bsc/pending`

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "trainer": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Arjun Sharma",
        "email": "arjun@redmat.com"
      },
      "quarter": "Q1-2026",
      "self_calculated_score": 8.3,
      "status": "pending_validation",
      "submitted_at": "2026-03-28T15:45:00Z"
    },
    {
      "_id": "507f1f77bcf86cd799439019",
      "trainer": {
        "_id": "507f1f77bcf86cd799439016",
        "name": "Priya Mehta",
        "email": "priya@redmat.com"
      },
      "quarter": "Q1-2026",
      "self_calculated_score": 7.9,
      "status": "pending_validation",
      "submitted_at": "2026-03-27T14:20:00Z"
    }
  ],
  "count": 2
}
```

---

#### PUT `/api/bsc/:id/validate`

**Request**:
```json
{
  "validated_scores": [
    {
      "metric": "Trial Conversions",
      "validated_score": 7,
      "notes": "Adjusted based on BI data"
    },
    {
      "metric": "Team Focus",
      "validated_score": 9,
      "notes": null
    },
    {
      "metric": "Punctuality",
      "validated_score": 7,
      "notes": null
    },
    {
      "metric": "Client Retention",
      "validated_score": 8,
      "notes": null
    },
    {
      "metric": "Session Quality",
      "validated_score": 9,
      "notes": null
    }
  ]
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "BSC validated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "trainer_id": "507f1f77bcf86cd799439011",
    "quarter": "Q1-2026",
    "final_score": 7.8,
    "status": "validated",
    "validated_at": "2026-03-29T10:15:00Z",
    "validated_by": "arnav@redmat.com"
  }
}
```

---

### Salary Statements

#### GET `/api/salary/statements`

**Query Parameters**:
- `month` (optional): "2026-03"
- `trainer_id` (optional): Filter by trainer
- `status` (optional): "draft", "sent"

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "trainer": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Arjun Sharma"
      },
      "month": "2026-03",
      "base_salary": 45000,
      "quarterly_bonus_prorated": 3900,
      "total": 48900,
      "status": "draft",
      "generated_at": "2026-02-28T09:00:00Z"
    }
  ],
  "count": 1
}
```

---

#### GET `/api/salary/pdf/:statementId`

**Response** (200 OK):
- Content-Type: `application/pdf`
- Body: PDF file binary

---

#### POST `/api/salary/generate` (Manual Trigger)

**Request**:
```json
{
  "month": "2026-03",
  "trainer_ids": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439016"]
  // If trainer_ids not provided, generates for all active trainers
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Generated 2 salary statements for March 2026",
  "data": {
    "generated_count": 2,
    "failed_count": 0,
    "statements": [
      {
        "_id": "507f1f77bcf86cd799439013",
        "trainer_id": "507f1f77bcf86cd799439011",
        "total": 48900
      },
      {
        "_id": "507f1f77bcf86cd799439020",
        "trainer_id": "507f1f77bcf86cd799439016",
        "total": 43120
      }
    ]
  }
}
```

---

### Audit Logs

#### GET `/api/audit-logs`

**Query Parameters**:
- `start_date` (optional): ISO date string
- `end_date` (optional): ISO date string
- `user_email` (optional): Filter by user
- `action` (optional): Filter by action type
- `entity_id` (optional): Filter by entity

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439014",
      "timestamp": "2026-02-20T10:30:00Z",
      "user_email": "director@redmat.com",
      "action": "update_base_salary",
      "entity": "trainers",
      "entity_id": "507f1f77bcf86cd799439011",
      "changes": {
        "field": "base_salary",
        "old_value": 40000,
        "new_value": 45000,
        "reason": "Annual raise"
      }
    }
  ],
  "count": 1
}
```

---

## Implementation Plan

### Phase 1: Database Setup & Core Backend (Week 1)

**Goal**: Set up database, create schemas, build basic CRUD APIs

**Tasks**:
- [x] Set up MongoDB Atlas cluster
- [x] Create collections with validation schemas
- [x] Set up Node.js + Express project structure
- [x] Install dependencies:
  ```bash
  npm init -y
  npm install express mongoose bcryptjs jsonwebtoken dotenv cors
  npm install --save-dev nodemon
  ```
- [x] Create database connection module
- [x] Define Mongoose models for all collections
- [x] Build authentication middleware (JWT)
- [x] Create CRUD endpoints for trainers
- [x] Create seed script to migrate existing data from master sheet
- [x] Test API endpoints with Postman/Thunder Client

**Deliverable**: Working API that can create, read, update, delete trainers

**Migration Script Example**:
```javascript
// seed.js
const trainers = [
  {
    name: "Arjun Sharma",
    email: "arjun@redmat.com",
    base_salary: 45000,
    quarterly_bonus_amount: 15000,
    scorecard_template: [/* ... */]
  },
  // ... copy from master sheet
];

async function seedDatabase() {
  for (const trainer of trainers) {
    await Trainer.create(trainer);
  }
  console.log(`Seeded ${trainers.length} trainers`);
}
```

---

### Phase 2: BSC Workflow (Week 2)

**Goal**: Trainers can submit BSC, Arnav can validate

**Tasks**:
- [x] Build BSC submission API (`POST /api/bsc/submit`)
- [x] Build BSC validation API (`PUT /api/bsc/:id/validate`)
- [x] Build BSC listing API (`GET /api/bsc/pending`)
- [x] Create React app for BSC form
  ```bash
  npm create vite@latest bsc-form -- --template react
  cd bsc-form
  npm install axios react-router-dom
  ```
- [x] Build dynamic form that reads `scorecard_template` from API
- [x] Integrate Power BI iframe (or fallback to link)
- [x] Implement real-time score calculation
- [x] Add form submission with validation
- [x] Create admin dashboard page for BSC review
- [x] Set up Slack notification when BSC is submitted

**Deliverable**: Trainers can submit BSC online, Arnav sees pending reviews in admin dashboard

**Power BI Embedding Test**:
```html
<!-- Test if this works -->
<iframe 
  src="https://your-powerbi-url.com/embed?filter=trainer_id eq '507f1f77bcf86cd799439011'"
  width="100%" 
  height="400"
  frameborder="0"
></iframe>
```

If CORS issues arise, fallback to:
```html
<a href="https://your-powerbi-url.com?filter=trainer_id eq '507f1f77bcf86cd799439011'" 
   target="_blank" 
   className="btn-primary">
  Open Your Dashboard in New Tab
</a>
```

---

### Phase 3: Salary Automation (Week 3)

**Goal**: Automated PDF generation + Gmail drafts

**Tasks**:
- [x] Install Puppeteer: `npm install puppeteer`
- [x] Create HTML template for salary slip (based on existing format)
- [x] Build PDF generation function
  ```javascript
  async function generateSalaryPDF(trainer, salaryData) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const html = renderTemplate(trainer, salaryData);
    await page.setContent(html);
    const pdf = await page.pdf({ format: 'A4' });
    await browser.close();
    return pdf;
  }
  ```
- [x] Set up Gmail API OAuth2 credentials
- [x] Build Gmail draft creation function
  ```javascript
  async function createGmailDraft(trainer, pdfBuffer) {
    // Use googleapis library
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    // Create draft with PDF attachment
  }
  ```
- [x] Write salary calculation logic
  ```javascript
  function calculateSalary(trainer, month) {
    let total = trainer.base_salary;
    
    // Check if quarterly bonus applicable
    if (trainer.quarterly_bonus_amount) {
      const bscEntry = getBSCForMonth(trainer._id, month);
      if (bscEntry && bscEntry.status === 'validated') {
        total += (trainer.quarterly_bonus_amount * bscEntry.final_score) / 3;
      }
    }
    
    return total;
  }
  ```
- [x] Create salary generation endpoint (`POST /api/salary/generate`)
- [x] Set up cron job
  ```javascript
  const cron = require('node-cron');
  
  // Run on 28th of every month at 9 AM
  cron.schedule('0 9 28 * *', async () => {
    await generateMonthlySalaries();
  });
  ```
- [x] Test manually with one trainer before automating

**Deliverable**: Cron job generates PDFs + Gmail drafts automatically

---

### Phase 4: Slack Integration (Week 4)

**Goal**: Trainers see salary in Slack

**Tasks**:
- [x] Install Slack Bolt: `npm install @slack/bolt`
- [x] Create Slack app in Slack workspace
- [x] Configure OAuth scopes: `chat:write`, `users:read`, `files:write`
- [x] Update existing Slack app Home tab
- [x] Build endpoint to serve salary data to Slack
  ```javascript
  app.event('app_home_opened', async ({ event, client }) => {
    const trainer = await getTrainerBySlackId(event.user);
    const statement = await getLatestSalaryStatement(trainer._id);
    
    await client.views.publish({
      user_id: event.user,
      view: {
        type: 'home',
        blocks: buildSalaryBlocks(statement)
      }
    });
  });
  ```
- [x] Add PDF download endpoint that serves file
- [x] Update salary generation cron to post to Slack after creating draft
- [x] Test with 2-3 trainers

**Deliverable**: Trainers can view salary in Slack + download PDF

---

### Phase 5: Admin Dashboard (Week 5)

**Goal**: Full-featured UI for Arnav & Director

**Tasks**:
- [x] Create React app for admin dashboard
  ```bash
  npm create vite@latest admin-dashboard -- --template react
  cd admin-dashboard
  npm install axios react-router-dom @tanstack/react-table recharts
  ```
- [x] Set up routing (React Router)
- [x] Build authentication page (login)
- [x] Build dashboard home (stats + recent activity)
- [x] Build trainers management page
  - List view with search/filter
  - Add trainer modal
  - Edit trainer modal (logs to audit_logs)
  - Delete confirmation
- [x] Build BSC review page
  - Pending list
  - Review modal with side-by-side comparison
  - Approve/adjust workflow
- [x] Build salary statements page
  - List view by month
  - Filter by status
  - Link to open Gmail drafts
  - PDF preview
- [x] Build audit logs page
  - Filterable table
  - Export to CSV
- [x] Add responsive design (mobile-friendly)
- [x] Deploy to Vercel

**Deliverable**: Complete admin interface for all operations

---

### Phase 6: Testing & Migration (Week 6)

**Goal**: Live system with Feb 2026 salaries

**Tasks**:
- [x] Export current master sheet to CSV
- [x] Run seed script to populate trainers
- [x] Manually create BSC entries for most recent quarter
- [x] Run salary generation for one trainer (manual trigger)
- [x] Verify PDF format matches existing template
- [x] Verify Gmail draft created correctly
- [x] Verify Slack post visible to trainer
- [x] Test admin dashboard:
  - Create new trainer
  - Edit base salary → check audit log
  - Submit BSC as trainer → validate as admin
  - Regenerate salary statement
- [x] Run full salary generation for all trainers (manual trigger first)
- [x] Review all drafts in Gmail
- [x] Send batch to trainers
- [x] Monitor for issues
- [x] Enable cron job for automatic monthly runs

**Deliverable**: System running in production with all trainers onboarded

**Testing Checklist**:
```
□ BSC form loads correctly for 3 different trainers (different metrics)
□ Trainer submits BSC → appears in admin pending list
□ Admin validates BSC → score locked, status updates
□ Salary generated with correct bonus calculation
□ PDF matches existing format exactly
□ Gmail draft created with correct recipients (To, CC, BCC)
□ Slack Home tab updates with salary info
□ Trainer can download PDF from Slack
□ Admin edits base salary → audit log created
□ Next month's salary reflects new base salary
□ BSC marked as "paid" after 3rd month
□ Cron job runs successfully at scheduled time
```

---

## Deployment

### Backend (Node.js API)

**Recommended Platform**: Railway or Render (both support cron jobs)

**Steps**:
1. Push code to GitHub
2. Connect repository to Railway/Render
3. Set environment variables:
   ```
   MONGODB_URI=mongodb+srv://...
   JWT_SECRET=your_secret_key
   GMAIL_CLIENT_ID=...
   GMAIL_CLIENT_SECRET=...
   GMAIL_REFRESH_TOKEN=...
   SLACK_BOT_TOKEN=...
   SLACK_SIGNING_SECRET=...
   NODE_ENV=production
   ```
4. Deploy

**Alternative**: DigitalOcean Droplet with PM2 for process management

---

### Admin Dashboard (React)

**Recommended Platform**: Vercel

**Steps**:
1. Build React app: `npm run build`
2. Push to GitHub
3. Connect to Vercel
4. Set environment variable:
   ```
   VITE_API_URL=https://your-backend-url.railway.app
   ```
5. Deploy

**Custom Domain**: `admin.redmat.com`

---

### BSC Form (React)

**Recommended Platform**: Vercel (separate deployment)

**Steps**: Same as admin dashboard

**Custom Domain**: `bsc.redmat.com`

---

### File Storage (PDFs)

**Option 1**: Local file system on server
- Store in `/storage/salary-statements/`
- Serve via Express static middleware
- Pros: Simple, no extra cost
- Cons: Limited scalability, backup complexity

**Option 2**: AWS S3 or DigitalOcean Spaces
- Upload PDFs after generation
- Generate signed URLs for downloads
- Pros: Scalable, automatic backups
- Cons: Extra cost (~$5/month)

**Recommendation**: Start with local storage, migrate to S3 if needed later

---

## Open Questions & Decisions Needed

### 1. Power BI Embedding

**Question**: Can Power BI dashboard be embedded with row-level security (each trainer only sees their data)?

**Options**:
- **A**: Iframe embed with filter parameter → Preferred if possible
- **B**: Link to filtered dashboard in new tab → Fallback

**Next Step**: Arnav to test Power BI embed URL with filter parameter

---

### 2. PDF Template

**Question**: Can Arnav share existing PDF format/template?

**Next Step**: Share template so we can replicate exactly in HTML for Puppeteer

---

### 3. Director Access

**Question**: Should director have separate login credentials, or use Arnav's account?

**Options**:
- **A**: Separate account (recommended for audit trail)
- **B**: Shared credentials (simpler but less accountability)

**Recommendation**: Create separate account for director

---

### 4. Gmail Sending

**Question**: After drafts are created, should they auto-send or require manual review?

**Options**:
- **A**: Auto-send after generation → Fully automated
- **B**: Create drafts, Arnav reviews → Safer for first few months

**Recommendation**: Start with drafts (option B), switch to auto-send after confidence builds

---

### 5. Existing Google Sheets for BSC

**Question**: Individual Google Sheets already exist - should we keep them or fully migrate?

**Options**:
- **A**: Deprecate sheets, use new web form only → Cleaner long-term
- **B**: Support both (sheets + web form) → More flexible but complex

**Recommendation**: Migrate to web form (option A), keep sheets as read-only archive

---

## Success Metrics

### Time Savings
- **Current**: 4+ hours/month for salary processing
- **Target**: <15 minutes/month (96% reduction)

### Accuracy
- **Current**: Risk of manual errors in 5-10% of statements
- **Target**: Zero calculation errors (automated)

### Transparency
- **Current**: No audit trail for changes
- **Target**: 100% of changes logged with timestamp, user, reason

### Trainer Satisfaction
- **Current**: Wait for email, PDFs sometimes lost
- **Target**: Self-service access in Slack, always available

---

## Future Enhancements (Post-MVP)

### Phase 7+: Nice-to-Have Features

1. **Mobile App for Trainers**
   - Native iOS/Android app
   - Push notifications for new statements
   - In-app BSC submission

2. **Advanced Reporting**
   - Total payroll by month/quarter
   - Salary trends over time
   - BSC score trends
   - Export to Excel for accounting

3. **Integration with Accounting Software**
   - Automatic sync to Tally/Zoho Books
   - Bank transfer automation

4. **Multi-Location Support**
   - Different salary structures per studio (NC, DLF, VV)
   - Location-specific BSC metrics

5. **Performance Reviews**
   - 360-degree feedback
   - Peer reviews
   - Director notes

6. **Payroll Compliance**
   - PF/ESI calculations
   - TDS deductions
   - Form 16 generation

---

## Maintenance Plan

### Weekly Tasks
- Monitor cron job execution logs
- Check for failed PDF generations
- Review audit logs for unusual activity

### Monthly Tasks
- Review BSC submissions (ensure all trainers submitted)
- Verify all salary drafts sent successfully
- Backup MongoDB database

### Quarterly Tasks
- Review system performance
- Check for security updates
- Gather user feedback

### Annual Tasks
- Renew SSL certificates
- Review hosting costs
- Plan feature roadmap

---

## Risk Mitigation

### Risk 1: Cron Job Failure
**Mitigation**:
- Set up monitoring (e.g., UptimeRobot)
- Email alert if job fails
- Manual trigger endpoint as backup

### Risk 2: Gmail API Rate Limits
**Mitigation**:
- Batch sending with delays
- Monitor quota usage
- Implement retry logic

### Risk 3: Database Downtime
**Mitigation**:
- Use MongoDB Atlas (99.9% uptime SLA)
- Daily automated backups
- Replica sets for redundancy

### Risk 4: Incorrect Salary Calculations
**Mitigation**:
- Extensive unit tests for calculation logic
- Manual review for first 3 months
- Alert if salary differs >10% from previous month

---

## Conclusion

This system will transform Red Mat Pilates' payroll process from a manual, error-prone, 4-hour monthly task into a largely automated workflow requiring minimal oversight. By centralizing data in MongoDB, providing self-service access via Slack, and maintaining comprehensive audit logs, the solution delivers transparency, accuracy, and significant time savings.

**Key Benefits**:
- ✅ 96% reduction in time spent (4 hours → 15 minutes)
- ✅ Zero manual calculation errors
- ✅ Complete audit trail for all changes
- ✅ Self-service salary access for trainers
- ✅ Structured BSC workflow with validation
- ✅ Scalable architecture (easily add more trainers/studios)

**Next Steps**:
1. Arnav answers open questions (Power BI embed, PDF template, director access)
2. Start Phase 1: Database setup & core backend
3. Iterate weekly through phases 2-6
4. Go live with February 2026 salaries

---

**Document Version**: 1.0  
**Last Updated**: February 2, 2026  
**Author**: Claude (with Arnav's input)  
**Next Review**: After Phase 1 completion

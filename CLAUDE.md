# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains a Slack Bot application for Red Mat Pilates trainers. The bot provides a personalized dashboard for trainers to access daily tasks, performance metrics, documents, and admin resources through Slack's App Home interface.

## Development Commands

### Setup
```bash
cd slack-botrmp
npm install
```

### Running the Application
```bash
npm run dev        # Run in development mode with ts-node
npm run build      # Compile TypeScript to JavaScript
npm start          # Run compiled JavaScript from dist/
npm run watch      # Watch mode - recompile on file changes
```

### Environment Variables
The `.env` file in `slack-botrmp/` contains required Slack API credentials:
- `SLACK_BOT_TOKEN` - Bot user OAuth token
- `SLACK_APP_TOKEN` - App-level token for Socket Mode
- `SLACK_SIGNING_SECRET` - Signing secret for request verification

Optional URL overrides for external services can also be configured via environment variables (see `src/config.ts`).

## Architecture

### Application Structure

The application follows a handler-based architecture using the Slack Bolt framework:

**Entry Point (`src/app.ts`)**
- Initializes the Slack Bolt app with Socket Mode
- Registers all handlers (commands, actions, events)
- Validates environment configuration

**Configuration Layer (`src/config.ts` + `src/config/trainers.ts`)**
- `config.ts` - Global configuration for URLs (Fresha, PunchPass, Power BI) and document lists
- `trainers.ts` - Trainer-specific personalization mapping Slack user IDs to their Google Sheets URLs
  - Includes `getTrainerDataWithFallback()` utility that returns default URLs if trainer not found
  - Trainers must be manually added to this config file with their Slack user ID

**Handlers (`src/handlers/`)**
- `events.ts` - Handles `app_home_opened` event, fetches user info, publishes personalized home view
- `commands.ts` - Slash commands (`/attendance`, `/schedule`, `/payments`, `/performance`)
  - All commands are DM-only for privacy
- `actions.ts` - Button click handlers and modal triggers
  - Handles both URL buttons (just ack) and modal-opening buttons
  - Fetches trainer-specific data for the scorecard/logs modal

**Views & Modals (`src/views/` + `src/modals/`)**
- `views/home.ts` - Main dashboard view with sections for Daily Tasks, Performance & Records, Documents & Forms
  - Accepts `userId` parameter for personalization
  - Uses strategic button styling (red `danger` for important actions, green `primary` for forms)
- `modals/documents.ts` - Salary slips and Form 16 tax documents modals
- `modals/scorecardLogs.ts` - Modal with 4 personalized links (BAL Score Card, Trainer Logs, Payment Advice, Leave Records)

### Key Design Patterns

**User Personalization Flow**
1. User opens App Home → `app_home_opened` event triggered
2. Handler fetches user's real name and Slack user ID
3. Calls `getTrainerDataWithFallback(userId)` to get personalized URLs
4. Passes both user info and URLs to `buildHomeView()`
5. View is published with personalized content

**Modal Opening Pattern**
1. Button in home view has `action_id` (not a URL)
2. Action handler in `actions.ts` catches the action_id
3. Handler fetches trainer-specific data using user ID from `body.user.id`
4. Opens modal with `client.views.open()` using `trigger_id` from body
5. Modal contains URL buttons that Slack handles automatically

**URL Buttons**
- Buttons with `url` field open links automatically - just need to `ack()` the action
- These are registered in `actions.ts` but only acknowledge, no other logic needed

### Color Scheme Strategy

The dashboard uses Slack's button styles for visual hierarchy:
- **`danger` (red)** - Important daily actions and key access points (Take Attendance, View Scorecard & Logs, Client Referral)
- **`primary` (green)** - Forms and positive actions (Performance Dashboard, Salary Slips, Form 16)
- **default (gray)** - Secondary actions (Update Availability, Update Health History)

## Trainer Configuration

To add a new trainer to the system:

1. Get their Slack user ID (from profile or Slack API)
2. Create their personalized Google Sheets:
   - BAL Score Card
   - Trainer Logs
   - Payment Advice
   - Leave Records
3. Add entry to `trainers` object in `src/config/trainers.ts`:
```typescript
'U12345678': {
  userId: 'U12345678',
  name: 'Trainer Name',
  memberId: 'TRAINER001',
  balScoreCardUrl: 'https://docs.google.com/spreadsheets/d/...',
  trainerLogsUrl: 'https://docs.google.com/spreadsheets/d/...',
  paymentAdviceUrl: 'https://docs.google.com/spreadsheets/d/...',
  leaveRecordsUrl: 'https://docs.google.com/spreadsheets/d/...',
}
```

If a trainer isn't in the config, they'll see placeholder URLs until added.

## Important Files

- `PLAN.md` - Detailed implementation plan for the dashboard redesign
- `.gitignore` - Excludes `.env`, `node_modules`, `dist/`
- `tsconfig.json` - TypeScript compilation targeting ES2020 with strict mode

## External Integrations

The bot integrates with several external platforms:
- **Fresha** - Trainer availability management
- **PunchPass** - Attendance tracking and client health history
- **Power BI** - Performance analytics dashboard
- **Google Forms** - Client referral submissions
- **Google Sheets** - Personalized trainer records (scorecard, logs, payments, leave)

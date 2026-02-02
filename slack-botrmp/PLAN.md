# Dashboard Redesign & Personalization Plan

## Overview
Redesign the Slack App Home dashboard with red accents, personalized URLs per trainer, and improved UX with modals for scorecard/logs access.

## Requirements

### 1. Personalized URLs
- Each trainer gets personalized Google Sheets URLs based on their Slack user ID
- Personalized resources:
  - BAL Score Card
  - Trainer Logs
  - Payment Advice
  - Leave Records

### 2. Button Updates

**Daily Tasks:**
- "Update My Availability" → Fresha (already correct)
- "Take Attendance" → punchpass.com/hub
- "Check My Schedule" → **Rename to** "Update Client's Health History" → app.punchpass.com/customers

**Performance & Admin:**
- "View Performance Dashboard" → Keep Power BI link
- "Check Balance/Logs" → **Replace with** button that opens modal with 4 options:
  1. BAL Score Card (personalized)
  2. Trainer Logs (personalized)
  3. Payment Advice (personalized)
  4. Leave Records (personalized)

**Documents & Forms:**
- Keep salary slips & Form 16 modals
- "Submit Client Referral" → Update to Google Forms placeholder

### 3. Design Improvements
- Add red color accents (using `danger` style buttons strategically)
- Improve visual hierarchy
- Make layout sleek and modern
- Better use of emojis and formatting
- Add visual polish with better section organization

## Implementation Steps

### Step 1: Create Trainer Configuration System
**File: `src/config/trainers.ts`**
- Create TypeScript interface for trainer data
- Export trainer mapping object (Slack user ID → trainer data)
- Include fields: name, memberId, balScoreCardUrl, trainerLogsUrl, paymentAdviceUrl, leaveRecordsUrl
- Add placeholder URLs that admin can fill in later

### Step 2: Update Main Configuration
**File: `src/config.ts`**
- Update punchpass attendance URL to punchpass.com/hub
- Add URL for customer health history (app.punchpass.com/customers)
- Add placeholder Google Forms URL for client referral
- Keep existing URLs that are correct

### Step 3: Create Scorecard/Logs Modal
**File: `src/modals/scorecardLogs.ts`**
- Create modal builder function that accepts personalized URLs
- Display 4 buttons:
  1. BAL Score Card (with link icon)
  2. Trainer Logs (with clipboard icon)
  3. Payment Advice (with money icon)
  4. Leave Records (with calendar icon)
- Use primary/danger button styles for visual appeal
- Add descriptive text explaining each option

### Step 4: Redesign Home View
**File: `src/views/home.ts`**
- Accept user ID parameter to fetch trainer-specific data
- Update welcome message with better formatting
- Redesign sections with red accents:
  - Use `danger` style buttons for primary actions
  - Use `primary` style (green) for secondary actions
  - Mix button styles strategically for visual hierarchy
- Update button labels:
  - "Check My Schedule" → "Update Client Health History"
  - "Check Balance/Logs" → "View Scorecard & Logs"
  - "Submit Client Referral" → "Pass New Client Referral"
- Add better emojis and formatting
- Improve spacing and visual flow
- Make "Core Hours This Month" dynamic-ready (placeholder for future API integration)

### Step 5: Update Event Handler
**File: `src/handlers/events.ts`**
- Pass Slack user ID to buildHomeView function
- Fetch trainer data from config
- Handle case where trainer is not found in config (use default URLs)

### Step 6: Update Action Handlers
**File: `src/handlers/actions.ts`**
- Add handler for "open_scorecard_logs_modal" action
- Fetch trainer-specific URLs based on user ID
- Open modal with personalized links
- Add handlers for the 4 new button actions (just acknowledge, URLs open automatically)

### Step 7: Update URL References
- Update all hardcoded URL references to use config
- Ensure punchpass.com/hub is used for attendance
- Ensure app.punchpass.com/customers is used for health history

## Design Decisions

### Color Scheme
- **Red accents**: Use `danger` style for key action buttons (attendance, scorecard)
- **Green accents**: Use `primary` style for positive actions (forms, referrals)
- **Default gray**: Use for secondary/tertiary actions

### Button Styling Strategy
**Daily Tasks:**
- Update Availability: default (gray)
- Take Attendance: `danger` (red) - important daily task
- Update Health History: default (gray)

**Performance & Admin:**
- View Performance: `primary` (green)
- View Scorecard & Logs: `danger` (red) - important access point

**Documents & Forms:**
- Salary Slips: `primary` (green) - keep as is
- Form 16: `primary` (green) - keep as is
- Client Referral: `danger` (red) - important for business growth

### Modal Design
- Clean, simple layout
- 4 buttons in 2 rows (2x2 grid)
- Each button with descriptive icon and clear label
- Brief description text at top explaining the resources

## Configuration Template

Trainers config will look like:
```typescript
{
  userId: "U12345678",
  name: "Taiyaba",
  memberId: "TRAINER001",
  balScoreCardUrl: "https://docs.google.com/spreadsheets/d/xxx",
  trainerLogsUrl: "https://docs.google.com/spreadsheets/d/yyy",
  paymentAdviceUrl: "https://docs.google.com/spreadsheets/d/zzz",
  leaveRecordsUrl: "https://docs.google.com/spreadsheets/d/www"
}
```

Admin will need to:
1. Get each trainer's Slack user ID (can be found via Slack API or profile)
2. Fill in their member ID
3. Create Google Sheets for each trainer (BAL, Logs, Payment, Leave)
4. Update the config file with actual URLs

## Files to Create/Modify

**New Files:**
- `src/config/trainers.ts` - Trainer configuration with personalized URLs
- `src/modals/scorecardLogs.ts` - Modal for scorecard/logs access

**Modified Files:**
- `src/config.ts` - Update URLs
- `src/views/home.ts` - Redesign with red accents and personalization
- `src/handlers/events.ts` - Pass user ID for personalization
- `src/handlers/actions.ts` - Add scorecard modal handler

**No changes needed:**
- `src/modals/documents.ts` - Salary slips and Form 16 modals work fine
- `src/handlers/commands.ts` - Slash commands work fine

## Testing Checklist

After implementation:
- [ ] Verify all URLs point to correct locations
- [ ] Test personalization works for different users
- [ ] Test fallback behavior when user not in config
- [ ] Verify scorecard modal opens with all 4 options
- [ ] Check visual appearance - red accents look good
- [ ] Test all buttons open correct URLs
- [ ] Verify button styles (red/green/gray) render correctly
- [ ] Test on different screen sizes (Slack desktop/mobile)

## Future Enhancements (Not in this plan)

- Dynamic "Core Hours This Month" from actual API
- WhatsApp Buddy Dashboard implementation
- Real-time notifications for new salary slips
- Analytics tracking for button clicks

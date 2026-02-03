# Gmail API Setup Guide

This guide walks you through setting up Gmail API access for automated salary statement draft creation.

## Overview

The system creates Gmail drafts (not automatically sent) with:
- **To**: Trainer's email
- **Cc**: Director, Founding Trainer
- **Bcc**: Accountant
- **Attachment**: PDF salary statement
- **Body**: Professional HTML email

## Prerequisites

- Google account with Gmail
- Access to Google Cloud Console
- Admin rights to enable APIs

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name: "RMP Payroll System"
4. Click "Create"

## Step 2: Enable Gmail API

1. In your project, go to **APIs & Services** → **Library**
2. Search for "Gmail API"
3. Click "Gmail API"
4. Click "Enable"

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **Internal** (if using Google Workspace) or **External**
3. Fill in:
   - App name: "RMP Payroll System"
   - User support email: your-email@redmatpilates.com
   - Developer contact: your-email@redmatpilates.com
4. Click "Save and Continue"
5. **Scopes**: Click "Add or Remove Scopes"
   - Search for "Gmail API"
   - Select: `https://www.googleapis.com/auth/gmail.compose`
   - Select: `https://www.googleapis.com/auth/gmail.modify`
6. Click "Save and Continue"
7. **Test users** (if External): Add your Gmail address
8. Click "Save and Continue"

## Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Desktop app**
4. Name: "RMP Payroll Desktop"
5. Click "Create"
6. **Download JSON** - Save this file (you'll need it)
7. Note your:
   - **Client ID**: `xxxxx.apps.googleusercontent.com`
   - **Client Secret**: `xxxxxx`

## Step 5: Get Refresh Token

You need to run a one-time authorization flow to get a refresh token.

### Option A: Using Node.js Script

Create `scripts/get-gmail-token.js`:

```javascript
const { google } = require('googleapis');
const readline = require('readline');

const CLIENT_ID = 'your-client-id.apps.googleusercontent.com';
const CLIENT_SECRET = 'your-client-secret';
const REDIRECT_URI = 'http://localhost';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify'
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent'
});

console.log('Authorize this app by visiting this URL:');
console.log(authUrl);
console.log('\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter the code from that page here: ', async (code) => {
  rl.close();

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\nYour refresh token:');
    console.log(tokens.refresh_token);
    console.log('\nAdd this to your .env file as GMAIL_REFRESH_TOKEN');
  } catch (error) {
    console.error('Error retrieving access token:', error);
  }
});
```

Run it:
```bash
node scripts/get-gmail-token.js
```

### Option B: Using OAuth Playground

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the ⚙️ icon (top right)
3. Check "Use your own OAuth credentials"
4. Enter your Client ID and Client Secret
5. Close settings
6. In "Step 1", find "Gmail API v1"
7. Select:
   - `https://www.googleapis.com/auth/gmail.compose`
   - `https://www.googleapis.com/auth/gmail.modify`
8. Click "Authorize APIs"
9. Sign in with your Google account
10. Click "Allow"
11. In "Step 2", click "Exchange authorization code for tokens"
12. Copy the **Refresh token**

## Step 6: Update .env File

Add to `packages/backend/.env`:

```env
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token

# Email recipients (optional)
DIRECTOR_EMAIL=director@redmatpilates.com
FOUNDING_TRAINER_EMAIL=foundingtrainer@redmatpilates.com
ACCOUNTANT_EMAIL=accountant@redmatpilates.com
```

## Step 7: Test Gmail Integration

1. Ensure MongoDB is running and has at least one trainer with email
2. Start the backend:
   ```bash
   npm run dev
   ```

3. Generate salary (requires admin JWT token):
   ```bash
   curl -X POST http://localhost:3000/api/salary/generate \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{"month": "2026-03"}'
   ```

4. Check Gmail drafts: https://mail.google.com/mail/u/0/#drafts
5. You should see a draft with the trainer's salary statement attached

## Troubleshooting

### Error: "Gmail authentication failed"
- Check `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` are correct
- Verify refresh token was generated with correct scopes
- Make sure you're using the same Google account

### Error: "Gmail API quota exceeded"
- Free tier: 1 billion quota units/day
- Creating a draft ≈ 100 quota units
- You can create ~10 million drafts/day (way more than needed)
- Check [Quota Usage](https://console.cloud.google.com/apis/api/gmail.googleapis.com/quotas)

### Error: "Invalid grant"
- Refresh token expired or revoked
- Re-generate refresh token (Step 5)
- Make sure you selected "access_type: offline" and "prompt: consent"

### Drafts not appearing in Gmail
- Check spam/trash folders
- Verify the Gmail account matches the one used for credentials
- Look in "All Mail" folder
- Check audit logs in console for errors

## Important Notes

1. **Refresh tokens don't expire** unless:
   - User revokes access
   - Token unused for 6 months (for external users)
   - User changes password

2. **Security**:
   - Never commit `.env` file to git
   - Keep refresh token secret
   - Rotate tokens periodically
   - Use Google Workspace for better security

3. **Rate Limits**:
   - 250 drafts per second (way more than needed)
   - Consider batch delays if generating 100+ statements

4. **Testing**:
   - Use test Gmail account first
   - Verify recipients are correct
   - Check PDF attachments open properly

## Production Considerations

1. **Google Workspace**: Recommended for business accounts
2. **Service Account**: Consider for higher security (requires domain-wide delegation)
3. **Monitoring**: Set up alerts for quota usage
4. **Backup**: Keep refresh token in secure vault
5. **Rotation**: Rotate credentials annually

## Support

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Node.js Quickstart](https://developers.google.com/gmail/api/quickstart/nodejs)
- [Error Codes](https://developers.google.com/gmail/api/guides/errors)

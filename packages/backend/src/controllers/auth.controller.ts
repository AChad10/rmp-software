import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { generateToken } from '../middleware/auth.middleware';

// Pre-hash the admin password at startup so we never compare plaintext at runtime.
// ADMIN_PASSWORD_HASH takes precedence (store a bcrypt hash directly).
// Falls back to hashing ADMIN_PASSWORD on boot (acceptable for single-admin setups).
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD_HASH: string | undefined =
  process.env.ADMIN_PASSWORD_HASH ??
  (process.env.ADMIN_PASSWORD ? bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12) : undefined);

if (!ADMIN_EMAIL || !ADMIN_PASSWORD_HASH) {
  console.warn('[SECURITY] ADMIN_EMAIL and ADMIN_PASSWORD (or ADMIN_PASSWORD_HASH) must be set in .env');
}

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const ALLOWED_EMAIL = 'business@redmatpilates.com';

let googleClient: OAuth2Client | null = null;
if (GOOGLE_CLIENT_ID) {
  googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
  console.log('[AUTH] Google OAuth configured');
} else {
  console.warn('[AUTH] Google OAuth not configured - GOOGLE_OAUTH_CLIENT_ID missing');
}

/**
 * POST /api/auth/login
 * Traditional email/password login
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required' });
      return;
    }

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD_HASH) {
      res.status(503).json({ success: false, error: 'Authentication not configured' });
      return;
    }

    // Constant-time comparison for email, bcrypt for password
    const emailMatch = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    const passwordMatch = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);

    if (!emailMatch || !passwordMatch) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const token = generateToken({
      userId: 'admin-1',
      email: ADMIN_EMAIL,
      role: 'admin',
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          userId: 'admin-1',
          email: ADMIN_EMAIL,
          name: 'Admin',
          role: 'admin',
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * POST /api/auth/google
 * Google OAuth login - verifies Google ID token and checks email whitelist
 */
export async function googleLogin(req: Request, res: Response): Promise<void> {
  try {
    const { credential } = req.body;

    if (!credential) {
      res.status(400).json({ success: false, error: 'Google credential is required' });
      return;
    }

    if (!googleClient) {
      res.status(503).json({ success: false, error: 'Google OAuth not configured on server' });
      return;
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(401).json({ success: false, error: 'Invalid Google token' });
      return;
    }

    const { email, name, picture, sub: googleId } = payload;

    // Check if email is whitelisted
    if (email.toLowerCase() !== ALLOWED_EMAIL.toLowerCase()) {
      console.warn(`[AUTH] Google login attempt from unauthorized email: ${email}`);
      res.status(403).json({
        success: false,
        error: 'Access denied. Only business@redmatpilates.com is authorized.'
      });
      return;
    }

    // Email verified and whitelisted - generate JWT token
    const token = generateToken({
      userId: `google-${googleId}`,
      email: email,
      role: 'admin',
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          userId: `google-${googleId}`,
          email: email,
          name: name || 'Admin',
          picture: picture,
          role: 'admin',
        },
      },
    });

    console.log(`[AUTH] Successful Google login: ${email}`);
  } catch (error: any) {
    console.error('Google login error:', error);
    res.status(401).json({
      success: false,
      error: 'Failed to verify Google credentials'
    });
  }
}

/**
 * GET /api/auth/google/config
 * Returns Google OAuth client ID for frontend
 */
export async function getGoogleConfig(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: {
      clientId: GOOGLE_CLIENT_ID || null,
      enabled: !!GOOGLE_CLIENT_ID,
    },
  });
}

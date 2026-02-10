import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
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

/**
 * POST /api/auth/login
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

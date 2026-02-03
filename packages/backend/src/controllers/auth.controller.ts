import { Request, Response } from 'express';
import { generateToken } from '../middleware/auth.middleware';

/**
 * POST /api/auth/login
 *
 * Development mode: accepts a single hardcoded admin account so you can
 * test without a users collection.  Set these in .env if you want custom creds:
 *   ADMIN_EMAIL    (default: admin@redmat.com)
 *   ADMIN_PASSWORD (default: admin123)
 *
 * Production: swap this out for bcrypt-based lookup against a users collection.
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required' });
      return;
    }

    // Credentials (override via env)
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@redmat.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (email !== adminEmail || password !== adminPassword) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const token = generateToken({
      userId: 'admin-1',
      email: adminEmail,
      role: 'admin',
    });

    res.json({
      success: true,
      token,
      user: {
        userId: 'admin-1',
        email: adminEmail,
        name: 'Admin',
        role: 'admin',
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

import { Router } from 'express';
import { getAllAuditLogs, getAuditLogsByTrainer } from '../controllers/auditLog.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// GET /api/audit-logs - Get all audit logs (admin only)
router.get('/', authenticateToken, requireAdmin, getAllAuditLogs);

// GET /api/audit-logs/trainer/:trainerId - Get audit logs for a specific trainer (admin only)
router.get('/trainer/:trainerId', authenticateToken, requireAdmin, getAuditLogsByTrainer);

export default router;

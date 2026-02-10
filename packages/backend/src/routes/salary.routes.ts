import { Router } from 'express';
import {
  generateSalaryStatements,
  getSalaryStatements,
  getSalaryStatementById,
  updateStatementStatus,
  createGmailDrafts
} from '../controllers/salary.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// Generate salary statements (admin only)
router.post('/generate', authenticateToken, requireAdmin, generateSalaryStatements);

// Create Gmail drafts for statements (admin only)
router.post('/create-drafts', authenticateToken, requireAdmin, createGmailDrafts);

// Get salary statements (admin only)
router.get('/statements', authenticateToken, requireAdmin, getSalaryStatements);

// Get single salary statement (admin only)
router.get('/statements/:id', authenticateToken, requireAdmin, getSalaryStatementById);

// Update statement status (admin only)
router.put('/statements/:id/status', authenticateToken, requireAdmin, updateStatementStatus);

export default router;

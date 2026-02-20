import { Router } from 'express';
import {
  generateSalaryStatements,
  generateSingleStatement,
  getSalaryStatements,
  getSalaryStatementById,
  updateStatementStatus,
  createGmailDrafts,
  downloadStatementPdf
} from '../controllers/salary.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// Generate salary statements (admin only)
router.post('/generate', authenticateToken, requireAdmin, generateSalaryStatements);

// Generate a single salary statement with preview data overrides (admin only)
router.post('/generate-single', authenticateToken, requireAdmin, generateSingleStatement);

// Create Gmail drafts for statements (admin only)
router.post('/create-drafts', authenticateToken, requireAdmin, createGmailDrafts);

// Get salary statements (admin only)
router.get('/statements', authenticateToken, requireAdmin, getSalaryStatements);

// Get single salary statement (admin only)
router.get('/statements/:id', authenticateToken, requireAdmin, getSalaryStatementById);

// Download/preview salary statement PDF (admin only)
router.get('/statements/:id/pdf', authenticateToken, requireAdmin, downloadStatementPdf);

// Update statement status (admin only)
router.put('/statements/:id/status', authenticateToken, requireAdmin, updateStatementStatus);

export default router;

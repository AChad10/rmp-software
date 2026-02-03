import { Router } from 'express';
import {
  generateSalaryStatements,
  getSalaryStatements,
  getSalaryStatementById,
  updateStatementStatus
} from '../controllers/salary.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// Generate salary statements (admin only)
router.post('/generate', authenticateToken, requireAdmin, generateSalaryStatements);

// Get salary statements (with filters)
router.get('/statements', getSalaryStatements);

// Get single salary statement
router.get('/statements/:id', getSalaryStatementById);

// Update statement status (admin only)
router.put('/statements/:id/status', authenticateToken, requireAdmin, updateStatementStatus);

export default router;

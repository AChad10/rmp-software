import { Router } from 'express';
import {
  sendLogSummaries,
  showConfirmationPage,
  confirmSessionLogs,
  generatePayouts,
  getPerClassStatements,
  updatePerClassStatus,
} from '../controllers/perclass.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// Send log summaries to per-class trainers (admin only)
router.post('/send-logs', authenticateToken, requireAdmin, sendLogSummaries);

// Confirmation pages (PUBLIC -- no auth required)
router.get('/confirm/:token', showConfirmationPage);
router.post('/confirm/:token', confirmSessionLogs);

// Generate payouts for confirmed statements (admin only)
router.post('/generate-payouts', authenticateToken, requireAdmin, generatePayouts);

// Get per-class statements (admin only)
router.get('/statements', authenticateToken, requireAdmin, getPerClassStatements);

// Update per-class statement status (admin only)
router.put('/statements/:id/status', authenticateToken, requireAdmin, updatePerClassStatus);

export default router;

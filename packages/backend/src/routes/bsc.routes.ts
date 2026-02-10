import { Router } from 'express';
import {
  submitBSC,
  getPendingBSC,
  validateBSC,
  getTrainerBSC,
  getAllBSC,
  checkBSCByToken
} from '../controllers/bsc.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// Submit BSC (public – trainer identified by BSC access token in controller)
router.post('/submit', submitBSC);

// Check existing submission (public – token verified in controller)
router.get('/check/:trainerId/:quarter', checkBSCByToken);

// Get all BSC entries (admin only)
router.get('/', authenticateToken, requireAdmin, getAllBSC);

// Get pending BSC entries (admin only)
router.get('/pending', authenticateToken, requireAdmin, getPendingBSC);

// Get BSC entries for specific trainer (admin only)
router.get('/trainer/:trainerId', authenticateToken, requireAdmin, getTrainerBSC);

// Validate BSC entry (admin only)
router.put('/:id/validate', authenticateToken, requireAdmin, validateBSC);

export default router;

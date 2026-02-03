import { Router } from 'express';
import {
  submitBSC,
  getPendingBSC,
  validateBSC,
  getTrainerBSC,
  getAllBSC
} from '../controllers/bsc.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// Submit BSC (trainers can submit their own)
router.post('/submit', submitBSC);

// Get all BSC entries
router.get('/', getAllBSC);

// Get pending BSC entries (admin only)
router.get('/pending', authenticateToken, requireAdmin, getPendingBSC);

// Get BSC entries for specific trainer
router.get('/trainer/:trainerId', getTrainerBSC);

// Validate BSC entry (admin only)
router.put('/:id/validate', authenticateToken, requireAdmin, validateBSC);

export default router;

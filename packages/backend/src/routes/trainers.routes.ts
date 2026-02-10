import { Router } from 'express';
import {
  getAllTrainers,
  getTrainerById,
  getTrainerByUserId,
  getTrainerByBscToken,
  regenerateBscToken,
  createTrainer,
  updateTrainer,
  deleteTrainer
} from '../controllers/trainers.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// BSC access token route (public – trainers use this to open their BSC form)
router.get('/bsc-access/:token', getTrainerByBscToken);

// Authenticated routes (admin)
router.get('/', authenticateToken, requireAdmin, getAllTrainers);
router.get('/user/:userId', authenticateToken, requireAdmin, getTrainerByUserId);
router.get('/:id', authenticateToken, requireAdmin, getTrainerById);

// Protected routes (require authentication and admin role)
router.post('/', authenticateToken, requireAdmin, createTrainer);
router.put('/:id', authenticateToken, requireAdmin, updateTrainer);
router.delete('/:id', authenticateToken, requireAdmin, deleteTrainer);
router.post('/:id/regenerate-bsc-token', authenticateToken, requireAdmin, regenerateBscToken);

export default router;

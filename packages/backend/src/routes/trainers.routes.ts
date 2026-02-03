import { Router } from 'express';
import {
  getAllTrainers,
  getTrainerById,
  getTrainerByUserId,
  createTrainer,
  updateTrainer,
  deleteTrainer
} from '../controllers/trainers.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// Public routes (for now - can add auth later)
router.get('/', getAllTrainers);
router.get('/user/:userId', getTrainerByUserId);
router.get('/:id', getTrainerById);

// Protected routes (require authentication and admin role)
router.post('/', authenticateToken, requireAdmin, createTrainer);
router.put('/:id', authenticateToken, requireAdmin, updateTrainer);
router.delete('/:id', authenticateToken, requireAdmin, deleteTrainer);

export default router;

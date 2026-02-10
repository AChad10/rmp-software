import { Router } from 'express';
import { createAllDrafts } from '../controllers/trainerLogs.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.post('/create-drafts', authenticateToken, requireAdmin, createAllDrafts);

export default router;

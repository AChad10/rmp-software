import { Router } from 'express';
import { login, googleLogin, getGoogleConfig } from '../controllers/auth.controller';

const router = Router();

router.post('/login', login);
router.post('/google', googleLogin);
router.get('/google/config', getGoogleConfig);

export default router;

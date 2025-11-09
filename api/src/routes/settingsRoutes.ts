// src/routes/settingsRoutes.ts
import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import { listOcrEngines, toggleOcrEngine } from '../controllers/ocrEngineController';

const router = Router();

router.use(authMiddleware);

router.get('/ocr-engines', listOcrEngines);
router.post('/ocr-engines/:id', toggleOcrEngine);

export default router;

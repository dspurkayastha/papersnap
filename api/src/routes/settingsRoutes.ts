// src/routes/settingsRoutes.ts
import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import { listOcrEngines, toggleOcrEngine } from '../controllers/ocrEngineController';

const router = Router();

router.use(authMiddleware);

// GET current OCR engine states (proxied from ocr-worker /engines)
router.get('/ocr-engines', listOcrEngines);

// POST toggle a specific OCR engine (proxied to ocr-worker /engines/:id)
router.post('/ocr-engines/:id', toggleOcrEngine);

export default router;

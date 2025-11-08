// src/routes/documentRoutes.ts
import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import { getDocumentOcr } from '../controllers/documentController';

const router = Router();

router.use(authMiddleware);

router.get('/:id/ocr', getDocumentOcr);

export default router;

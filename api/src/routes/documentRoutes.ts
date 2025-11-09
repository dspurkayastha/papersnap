// src/routes/documentRoutes.ts
import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import { getDocumentOcr, verifyDocument } from '../controllers/documentController';

const router = Router();

router.use(authMiddleware);

router.get('/:id/ocr', getDocumentOcr);
router.patch('/:id/verify', verifyDocument);

export default router;

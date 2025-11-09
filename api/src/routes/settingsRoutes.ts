// src/routes/settingsRoutes.ts
import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import { fetchOcrEngines, updateOcrEngine } from '../services/ocrSettingsClient';

const router = Router();

router.use(authMiddleware);

router.get('/ocr-engines', async (_req, res) => {
  try {
    const engines = await fetchOcrEngines();
    return res.json({ engines });
  } catch (error: any) {
    console.error('Failed to fetch OCR engine settings:', error);
    const message = error?.message ?? 'Unable to fetch OCR engine settings';
    return res.status(502).json({ message });
  }
});

router.post('/ocr-engines/:id', async (req, res) => {
  const { id } = req.params;
  const { enabled } = req.body ?? {};

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ message: 'enabled must be a boolean' });
  }

  try {
    const engines = await updateOcrEngine(id, enabled);
    return res.json({ engines });
  } catch (error: any) {
    console.error(`Failed to update OCR engine ${id}:`, error);
    const message = error?.message ?? 'Unable to update OCR engine';
    return res.status(502).json({ message });
  }
});

export default router;

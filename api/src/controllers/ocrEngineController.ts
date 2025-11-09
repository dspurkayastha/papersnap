// src/controllers/ocrEngineController.ts
import { Request, Response } from 'express';
import { fetchOcrEngines, updateOcrEngine } from '../services/ocrSettingsClient';

export const listOcrEngines = async (_req: Request, res: Response) => {
  try {
    const engines = await fetchOcrEngines();
    return res.json({ engines });
  } catch (error: any) {
    console.error('Failed to fetch OCR engine settings:', error);
    const message = error?.message ?? 'Unable to fetch OCR engine settings';
    return res.status(502).json({ message });
  }
};

export const toggleOcrEngine = async (req: Request, res: Response) => {
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
};

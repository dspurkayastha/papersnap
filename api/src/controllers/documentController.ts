// src/controllers/documentController.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getDocumentOcr = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { id } = req.params;

  try {
    const document = await prisma.document.findUnique({
      where: { id },
      include: { case: true },
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.case.userId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    return res.json({
      id: document.id,
      ocrStatus: document.ocrStatus,
      rawText: document.rawText,
      parsedFields: document.parsedFields,
    });
  } catch (error) {
    console.error('Error fetching document OCR data:', error);
    return res.status(500).json({ message: 'Unable to fetch document OCR data' });
  }
};

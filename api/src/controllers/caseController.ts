// src/controllers/caseController.ts
import { Request, Response } from 'express';
import { PrismaClient, DocumentType, OcrStatus } from '@prisma/client';

const prisma = new PrismaClient();

export const createCase = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const newCase = await prisma.case.create({
      data: {
        userId: req.user.id,
      },
    });

    return res.status(201).json(newCase);
  } catch (error) {
    console.error('Error creating case:', error);
    return res.status(500).json({ message: 'Unable to create case' });
  }
};

export const getCases = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const cases = await prisma.case.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(cases);
  } catch (error) {
    console.error('Error fetching cases:', error);
    return res.status(500).json({ message: 'Unable to fetch cases' });
  }
};

export const getCaseById = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { id } = req.params;

  try {
    const caseRecord = await prisma.case.findFirst({
      where: {
        id,
        userId: req.user.id,
      },
      include: {
        documents: true,
      },
    });

    if (!caseRecord) {
      return res.status(404).json({ message: 'Case not found' });
    }

    return res.json(caseRecord);
  } catch (error) {
    console.error('Error fetching case:', error);
    return res.status(500).json({ message: 'Unable to fetch case' });
  }
};

export const uploadDocument = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { id } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ message: 'File is required' });
  }

  try {
    const caseRecord = await prisma.case.findFirst({
      where: {
        id,
        userId: req.user.id,
      },
    });

    if (!caseRecord) {
      return res.status(404).json({ message: 'Case not found' });
    }

    const document = await prisma.document.create({
      data: {
        caseId: caseRecord.id,
        type: DocumentType.OTHER,
        filePath: file.path,
        ocrStatus: OcrStatus.PENDING,
      },
    });

    return res.status(201).json(document);
  } catch (error) {
    console.error('Error uploading document:', error);
    return res.status(500).json({ message: 'Unable to upload document' });
  }
};

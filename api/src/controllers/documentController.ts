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
      verifiedFields: document.verifiedFields,
      isVerified: document.isVerified,
    });
  } catch (error) {
    console.error('Error fetching document OCR data:', error);
    return res.status(500).json({ message: 'Unable to fetch document OCR data' });
  }
};

export const verifyDocument = async (req: Request, res: Response) => {
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

    const body = req.body ?? {};

    const verifiedUpdates: Record<string, unknown> = {};
    const caseUpdates: Record<string, unknown> = {};

    if (body.surgeryDate !== undefined) {
      if (typeof body.surgeryDate !== 'string') {
        return res.status(400).json({ message: 'surgeryDate must be a string' });
      }
      const date = new Date(body.surgeryDate);
      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({ message: 'surgeryDate must be a valid date string' });
      }
      verifiedUpdates.surgeryDate = body.surgeryDate;
      caseUpdates.surgeryDate = date;
    }

    if (body.patientAge !== undefined) {
      const age = typeof body.patientAge === 'string' ? Number(body.patientAge) : body.patientAge;
      if (!Number.isInteger(age) || age < 0) {
        return res.status(400).json({ message: 'patientAge must be a non-negative integer' });
      }
      verifiedUpdates.patientAge = age;
      caseUpdates.patientAge = age;
    }

    if (body.patientSex !== undefined) {
      if (typeof body.patientSex !== 'string') {
        return res.status(400).json({ message: 'patientSex must be a string' });
      }
      verifiedUpdates.patientSex = body.patientSex;
      caseUpdates.patientSex = body.patientSex;
    }

    if (body.diagnosis !== undefined) {
      if (typeof body.diagnosis !== 'string') {
        return res.status(400).json({ message: 'diagnosis must be a string' });
      }
      verifiedUpdates.diagnosis = body.diagnosis;
      caseUpdates.diagnosis = body.diagnosis;
    }

    if (body.procedure !== undefined) {
      if (typeof body.procedure !== 'string') {
        return res.status(400).json({ message: 'procedure must be a string' });
      }
      verifiedUpdates.procedure = body.procedure;
      caseUpdates.procedure = body.procedure;
    }

    if (body.surgeon !== undefined) {
      if (typeof body.surgeon !== 'string') {
        return res.status(400).json({ message: 'surgeon must be a string' });
      }
      verifiedUpdates.surgeon = body.surgeon;
      caseUpdates.surgeon = body.surgeon;
    }

    if (body.emergencyFlag !== undefined) {
      if (typeof body.emergencyFlag !== 'boolean') {
        return res.status(400).json({ message: 'emergencyFlag must be a boolean' });
      }
      verifiedUpdates.emergencyFlag = body.emergencyFlag;
      caseUpdates.emergencyFlag = body.emergencyFlag;
    }

    if (Object.keys(verifiedUpdates).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided for verification' });
    }

    const existingVerified = (document.verifiedFields ?? {}) as Record<string, unknown>;
    const mergedVerified = { ...existingVerified, ...verifiedUpdates };

    const updatedDocument = await prisma.document.update({
      where: { id: document.id },
      data: {
        verifiedFields: mergedVerified,
        isVerified: true,
      },
      select: {
        id: true,
        isVerified: true,
        verifiedFields: true,
      },
    });

    if (Object.keys(caseUpdates).length > 0) {
      await prisma.case.update({
        where: { id: document.caseId },
        data: caseUpdates,
      });
    }

    return res.json(updatedDocument);
  } catch (error) {
    console.error('Error verifying document:', error);
    return res.status(500).json({ message: 'Unable to verify document' });
  }
};

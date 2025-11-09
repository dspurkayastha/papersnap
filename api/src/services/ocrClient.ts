// src/services/ocrClient.ts
import axios from 'axios';
import fs from 'fs/promises';
import { PrismaClient, OcrStatus, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const OCR_WORKER_URL = process.env.OCR_WORKER_URL ?? 'http://localhost:8001';

export type OcrWorkerResponse = {
  rawText?: string | null;
  schemaType?: string | null;
  parsedFields?: Record<string, unknown> | null;
  ocrMeta?: Record<string, unknown> | null;
};

const markFailed = async (documentId: string) => {
  try {
    await prisma.document.update({
      where: { id: documentId },
      data: { ocrStatus: OcrStatus.FAILED },
    });
  } catch (updateError) {
    console.error('Failed to mark document OCR status as FAILED:', updateError);
  }
};

export const requestOcrAnalysis = async (
  documentId: string,
  filePath: string
): Promise<void> => {
  // Ensure the file is actually reachable from the API container’s perspective
  try {
    await fs.access(filePath);
  } catch (fsError) {
    console.error('OCR worker cannot access file path:', filePath, fsError);
    await markFailed(documentId);
    return;
  }

  try {
    const response = await axios.post<OcrWorkerResponse>(
      `${OCR_WORKER_URL}/analyze`,
      {
        documentId,
        file_path: filePath,
      },
      {
        timeout: 30_000,
      }
    );

    const data = response.data ?? {};

    const parsedFieldsValue =
      data.parsedFields === undefined ? undefined : (data.parsedFields ?? Prisma.JsonNull);
    const ocrMetaValue =
      data.ocrMeta === undefined ? undefined : (data.ocrMeta ?? Prisma.JsonNull);

    const updateData: Prisma.DocumentUpdateInput = {
      ocrStatus: OcrStatus.COMPLETED,
      rawText: data.rawText ?? null,
      schemaType: data.schemaType ?? null,
    };

    if (parsedFieldsValue !== undefined) {
      updateData.parsedFields = parsedFieldsValue as Prisma.InputJsonValue;
    }

    if (ocrMetaValue !== undefined) {
      updateData.ocrMeta = ocrMetaValue as Prisma.InputJsonValue;
    }

    await prisma.document.update({
      where: { id: documentId },
      data: updateData,
    });
  } catch (error) {
    console.error('OCR worker request failed:', error);
    await markFailed(documentId);
  }
};


// src/services/ocrClient.ts
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { PrismaClient, OcrStatus } from '@prisma/client';

const prisma = new PrismaClient();

const OCR_WORKER_URL = process.env.OCR_WORKER_URL ?? 'http://localhost:8001';

export const requestOcrAnalysis = async (documentId: string, filePath: string): Promise<void> => {
  const fileStream = fs.createReadStream(filePath);
  const formData = new FormData();
  formData.append('documentId', documentId);
  formData.append('file', fileStream, path.basename(filePath));

  try {
    const response = await axios.post(`${OCR_WORKER_URL}/analyze`, formData, {
      headers: formData.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 30_000,
    });

    const { rawText = null, fields = null } = response.data ?? {};

    await prisma.document.update({
      where: { id: documentId },
      data: {
        ocrStatus: OcrStatus.COMPLETED,
        rawText,
        parsedFields: fields,
      },
    });
  } catch (error) {
    console.error('OCR worker request failed:', error);

    try {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          ocrStatus: OcrStatus.FAILED,
        },
      });
    } catch (updateError) {
      console.error('Failed to mark document OCR status as FAILED:', updateError);
    }
  } finally {
    fileStream.destroy();
  }
};

// src/services/ocrSettingsClient.ts
import axios, { AxiosError } from 'axios';

const OCR_WORKER_URL = process.env.OCR_WORKER_URL ?? 'http://localhost:8001';

export type OcrEngineState = {
  id: string;
  name: string;
  enabled: boolean;
  available: boolean;
  reason?: string | null;
};

const normalizeEngineResponse = (payload: unknown): OcrEngineState[] => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload as OcrEngineState[];
  }

  if (typeof payload === 'object' && 'engines' in (payload as Record<string, unknown>)) {
    const enginesValue = (payload as { engines?: unknown }).engines;
    if (Array.isArray(enginesValue)) {
      return enginesValue as OcrEngineState[];
    }
  }

  if (typeof payload === 'object') {
    return Object.values(payload as Record<string, OcrEngineState>);
  }

  return [];
};

const wrapError = (error: unknown, message: string): Error => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const detail = axiosError.response?.data ?? axiosError.message;
    return new Error(`${message}: ${detail}`);
  }

  return new Error(`${message}: ${String(error)}`);
};

export const fetchOcrEngines = async (): Promise<OcrEngineState[]> => {
  try {
    const response = await axios.get(`${OCR_WORKER_URL}/engines`, {
      timeout: 10_000,
    });
    return normalizeEngineResponse(response.data);
  } catch (error) {
    throw wrapError(error, 'Failed to fetch OCR engines');
  }
};

export const updateOcrEngine = async (id: string, enabled: boolean): Promise<OcrEngineState[]> => {
  try {
    const response = await axios.post(
      `${OCR_WORKER_URL}/engines/${encodeURIComponent(id)}`,
      { enabled },
      { timeout: 10_000 }
    );
    return normalizeEngineResponse(response.data);
  } catch (error) {
    throw wrapError(error, `Failed to update OCR engine ${id}`);
  }
};

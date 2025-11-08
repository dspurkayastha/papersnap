// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';

interface HttpError extends Error {
  status?: number;
}

const errorHandler = (err: HttpError, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ message });
};

export default errorHandler;

// src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/env';

interface AuthTokenPayload {
  userId: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
    };
  }
}

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication token missing' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as AuthTokenPayload;
    req.user = { id: payload.userId };
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export default authMiddleware;

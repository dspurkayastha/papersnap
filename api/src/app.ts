// src/app.ts
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import caseRoutes from './routes/caseRoutes';
import errorHandler from './middleware/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/cases', caseRoutes);

app.use(errorHandler);

export default app;

// src/config/env.ts
import dotenv from 'dotenv';

dotenv.config();

interface EnvConfig {
  DATABASE_URL: string;
  JWT_SECRET: string;
  PORT: number;
}

const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'PORT'] as const;

type RequiredVar = typeof requiredVars[number];

function getEnvVar(key: RequiredVar): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const config: EnvConfig = {
  DATABASE_URL: getEnvVar('DATABASE_URL'),
  JWT_SECRET: getEnvVar('JWT_SECRET'),
  PORT: Number(getEnvVar('PORT')),
};

if (Number.isNaN(config.PORT)) {
  throw new Error('PORT must be a valid number');
}

export default config;

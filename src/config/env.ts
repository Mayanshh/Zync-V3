import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  PORT: z.string().default('8080'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(10),
});

export const env = envSchema.parse(process.env);
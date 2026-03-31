import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { env } from '../config/env.js';

// 1. Create the PostgreSQL connection pool using your Env variable
const pool = new pg.Pool({ 
  connectionString: env.DATABASE_URL 
});

// 2. Initialize the Prisma adapter for Postgres
const adapter = new PrismaPg(pool);

// 3. Pass the adapter into the PrismaClient constructor
// This satisfies the "non-empty, valid PrismaClientOptions" requirement
export const prisma = new PrismaClient({ adapter });

// Optional: Helpful log to verify the DB connection
pool.on('connect', () => {
  console.log('🐘 PostgreSQL connected successfully');
});

pool.on('error', (err) => {
  console.error('Prisma Postgres Pool Error:', err.message);
});
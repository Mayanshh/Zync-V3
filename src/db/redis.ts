import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export const redis = new Redis(env.REDIS_URL, {
  // 1. This prevents the "MaxRetriesPerRequestError" crash
  maxRetriesPerRequest: null, 
  
  // 2. Upstash (and most cloud providers) require TLS
  // If your URL starts with 'rediss://', ioredis handles this, 
  // but adding this object ensures it stays stable.
  tls: {
    rejectUnauthorized: false
  },
  
  // 3. Keep-alive helps prevent 'ECONNRESET' on idle connections
  keepAlive: 10000, 
});

// Add these listeners so you can see what's happening in your console
redis.on('connect', () => console.log('Successfully connected to Upstash Redis!'));
redis.on('error', (err) => console.error('Redis Connection Error:', err.message));
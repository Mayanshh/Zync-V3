import { Queue } from 'bullmq';
import { redis } from '../db/redis.js';

// Define the Queue - this acts as the "To-Do List"
export const notificationQueue = new Queue('notifications', { 
  connection: redis 
});
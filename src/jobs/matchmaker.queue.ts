import { Queue } from 'bullmq';
import { redis } from '../db/redis.js';

// 1. Create the Queue
export const matchmakerQueue = new Queue('matchmaker', { 
  connection: redis 
});

/**
 * Trigger this from your Geo Controller when a user pings their location.
 */
export const addMatchmakingJob = async (userId: string) => {
  await matchmakerQueue.add(
    'find-matches', 
    { userId }, 
    { 
      jobId: `match:${userId}`, // Prevents duplicate active jobs for the same user
      removeOnComplete: true 
    }
  );
};
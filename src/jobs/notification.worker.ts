import { Worker } from 'bullmq';
import { redis } from '../db/redis.js';
import { EmailService } from '../services/email/email.service.js';

export const notificationWorker = new Worker(
  'notifications',
  async (job) => {
    const { type, payload } = job.data;

    console.log(`[BullMQ] 🏗️  Processing Job: ${job.id} | Type: ${type}`);

    switch (type) {
      case 'CONNECTION_REQUEST_EMAIL':
        await EmailService.sendConnectionNotice(payload.email, payload.senderName);
        break;

      case 'WELCOME_EMAIL':
        await EmailService.sendWelcomeEmail(payload.email, payload.name);
        break;

      case 'PUSH_NOTIFICATION':
        // 📱 Future: Logic to emit via Socket.io or Firebase
        console.log(`[BullMQ] 📱 Push notification triggered for: ${payload.userId}`);
        break;

      default:
        console.warn(`[BullMQ] ⚠️  Unknown job type: ${type}`);
    }
  },
  {
    connection: redis,
    concurrency: 5, // Process 5 emails/notifications in parallel
    removeOnComplete: { count: 100 }, // Don't clog Redis with old success logs
    removeOnFail: { count: 500 },    // Keep more failures for debugging
  }
);

// --- Event Listeners for better logging ---
notificationWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} (Type: ${job.data.type}) finished successfully.`);
});

notificationWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed: ${err.message}`);
});
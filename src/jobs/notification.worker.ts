import { Worker } from 'bullmq';
import { redis } from '../db/redis.js';
import { prisma } from '../db/prisma.js';
import { EmailService } from '../services/email/email.service.js';
import { PresenceManager } from '../sockets/presence.js';
import { PushService } from '../services/notifications/push.service.js';
import { io } from '../sockets/io.js';

export const notificationWorker = new Worker(
  'notifications',
  async (job) => {
    const { type, payload } = job.data;

    console.log(`[BullMQ] 🏗️ Processing Job: ${job.id} | Type: ${type}`);

    switch (type) {
      case 'PUSH_NOTIFICATION': {
        const { userId, title, body, data } = payload;
        
        // 1. Check if user is online
        const socketId = await PresenceManager.isOnline(userId);

        if (socketId) {
          io.to(socketId).emit('notification', { title, body, ...data });
        } else {
          // 2. Fallback to Web Push
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { pushSubscription: true }
          });

          // Casting to any because JSON types can be tricky in Prisma
          if (user?.pushSubscription) {
            await PushService.send(user.pushSubscription as any, title, body);
          }
        }
        break;
      }

      case 'CONNECTION_REQUEST_EMAIL':
        await EmailService.sendConnectionNotice(payload.email, payload.senderName);
        break;

      case 'WELCOME_EMAIL':
        await EmailService.sendWelcomeEmail(payload.email, payload.name);
        break;

      default:
        console.warn(`[BullMQ] ⚠️ Unknown job type: ${type}`);
    }
  },
  { 
    connection: redis, 
    concurrency: 5 
  }
);
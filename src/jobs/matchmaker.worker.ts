import { Worker } from 'bullmq';
import { redis } from '../db/redis.js';
import { prisma } from '../db/prisma.js';
import { RecommendationEngine } from '../modules/users/algo.service.js';
import { PresenceManager } from '../sockets/presence.js';
import { PushService } from '../services/notifications/push.service.js';
import { io } from '../sockets/io.js';

export const matchmakerWorker = new Worker('matchmaker', async (job) => {
  const { userId } = job.data;

  // 1. Get the user & ensure they have location data
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.lat === null || user.lon === null) return;

  // 2. Run the High-Fidelity Algorithm
  // We cast to any to satisfy the strict 'null' checks since we guarded above
  const topMatches = await RecommendationEngine.computeHighFidelityMatches(user as any, 1) as any[];
  
  if (topMatches.length === 0) return; 
  const match = topMatches[0];

  // 3. Anti-Spam Check: Don't notify the same pair twice in 1 hour
  const cooldownKey = `match_notif:${user.id}:${match.id}`;
  const hasNotified = await redis.get(cooldownKey);
  if (hasNotified) return;

  // 4. Notification Routing Logic
  const targetSocket = await PresenceManager.isOnline(match.id);

  if (targetSocket) {
    // USER IS ONLINE: Socket.io Emit
    io.to(targetSocket).emit('new_stellar_match', {
      message: `You and ${user.displayName} have a ${Math.round(match.totalMatchScore)}% vibe match!`,
      user: { id: user.id, name: user.displayName, avatar: user.avatarUrl }
    });
  } else {
    // USER IS OFFLINE: Web Push
    const targetUser = await prisma.user.findUnique({ 
      where: { id: match.id }, 
      select: { pushSubscription: true } 
    });

    if (targetUser?.pushSubscription) {
      // Note: We use PushService.send
      await PushService.send(
        targetUser.pushSubscription as any,
        'Zync Match Found ⚡',
        `${user.displayName} is nearby and shares your vibe.`
      );
    }
  }

  // Set cooldown so we don't annoy them
  await redis.set(cooldownKey, 'true', 'EX', 3600);

}, { connection: redis });
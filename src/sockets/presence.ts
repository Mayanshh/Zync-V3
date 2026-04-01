import { redis } from '../db/redis.js';

export class PresenceManager {
    // Add this method inside your PresenceManager class
static async isOnline(userId: string): Promise<string | null> {
  return await redis.get(`presence:${userId}`);
}
  private static readonly PRESENCE_PREFIX = 'presence:';
  private static readonly LAST_SEEN_PREFIX = 'last_seen:';
  // 5 minutes - if no heartbeat, they are considered "Inactive"
  private static readonly TTL = 300; 

  /**
   * Updates user status and refreshes their "Last Active" timestamp.
   * We use a separate key for last_seen that lasts longer (24h) for the Recency Boost.
   */
  static async setOnline(userId: string, socketId: string) {
    const now = Math.floor(Date.now() / 1000);
    
    await Promise.all([
      // 1. Mark as "Real-time Online" (Short TTL)
      redis.set(`${this.PRESENCE_PREFIX}${userId}`, socketId, 'EX', this.TTL),
      
      // 2. Update global "Last Active" (Long TTL for matching engine)
      redis.set(`${this.LAST_SEEN_PREFIX}${userId}`, now, 'EX', 86400)
    ]);
  }

  /**
   * Batch check for multiple users (Crucial for the Discovery Feed)
   * Prevents N+1 Redis calls.
   */
  static async getMultiplePresence(userIds: string[]): Promise<Record<string, boolean>> {
    if (userIds.length === 0) return {};
    
    const keys = userIds.map(id => `${this.PRESENCE_PREFIX}${id}`);
    const results = await redis.mget(...keys);
    
    const presenceMap: Record<string, boolean> = {};
    userIds.forEach((id, index) => {
      presenceMap[id] = results[index] !== null;
    });
    
    return presenceMap;
  }

  static async setOffline(userId: string) {
    await redis.del(`${this.PRESENCE_PREFIX}${userId}`);
    // Note: We do NOT delete last_seen, so we can still show "Last active 5m ago"
  }

  static async getLastSeen(userId: string): Promise<number | null> {
    const val = await redis.get(`${this.LAST_SEEN_PREFIX}${userId}`);
    return val ? parseInt(val) : null;
  }
}
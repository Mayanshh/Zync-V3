import { prisma } from '../../db/prisma.js';
import { redis } from '../../db/redis.js';

export class UserService {
  // 1. Fetch Profile (Optimized for performance)
  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        displayName: true, 
        bio: true, 
        spotifyTopGenres: true, 
        driftMode: true, 
        createdAt: true,
        avatarUrl: true 
      }
    });
    
    if (!user) throw new Error('User not found');
    return user;
  }

  // 2. Update Profile & Sync Spotify Data
  static async updateProfile(userId: string, data: { displayName?: string; bio?: string; spotifyTopGenres?: string[] }) {
    return await prisma.user.update({
      where: { id: userId },
      data, 
      select: { 
        id: true, 
        displayName: true, 
        bio: true, 
        spotifyTopGenres: true 
      }
    });
  }

  // 3. The "Discovery" Engine: Suggest users by shared Spotify genres
  static async getSuggestions(userId: string, limit = 10) {
    // A. Grab the current user's genres
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { spotifyTopGenres: true }
    });

    if (!currentUser || currentUser.spotifyTopGenres.length === 0) {
      // Fallback: Just suggest active users if no music data exists
      return await prisma.user.findMany({
        where: { id: { not: userId }, driftMode: false },
        take: limit,
        select: { id: true, displayName: true, avatarUrl: true }
      });
    }

    /** * B. PostgreSQL Array Intersect Query
     * This calculates a 'matchScore' based on common genres in the string array.
     */
    const suggestions = await prisma.$queryRaw`
      SELECT 
        u.id, 
        u."displayName", 
        u."avatarUrl", 
        u.bio,
        u."spotifyTopGenres",
        cardinality(ARRAY(
          SELECT UNNEST(u."spotifyTopGenres")
          INTERSECT
          SELECT UNNEST(${currentUser.spotifyTopGenres}::text[])
        )) AS "matchScore"
      FROM "User" u
      WHERE u.id != ${userId}
        AND u."driftMode" = false
      GROUP BY u.id
      HAVING cardinality(ARRAY(
        SELECT UNNEST(u."spotifyTopGenres")
        INTERSECT
        SELECT UNNEST(${currentUser.spotifyTopGenres}::text[])
      )) > 0
      ORDER BY "matchScore" DESC
      LIMIT ${limit};
    `;

    return suggestions;
  }

  // 4. Toggle Invisibility (Instant Ghost)
  static async toggleDriftMode(userId: string, isEnabled: boolean) {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { driftMode: isEnabled },
      select: { id: true, email: true, driftMode: true }
    });

    // Remove from Redis immediately so they disappear from the map
    if (isEnabled) {
      await redis.zrem('user:locations', userId);
    }

    return updatedUser;
  }
}
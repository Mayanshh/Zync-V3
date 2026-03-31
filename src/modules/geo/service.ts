import { redis } from '../../db/redis.js';
import { prisma } from '../../db/prisma.js';

export class GeoService {
  private static GEO_KEY = 'zync:live_locations';

  /**
   * Updates user location in Redis. 
   * Updates DB lat/lon occasionally or during this call for persistence.
   */
  static async updateLocation(userId: string, lon: number, lat: number) {
    // 1. Safety Check: If user is in Drift Mode, they stay invisible
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { driftMode: true }
    });
    
    if (user?.driftMode) {
      await redis.zrem(this.GEO_KEY, userId);
      return false;
    }

    // 2. Add to Redis (Extremely fast O(log(N)))
    await redis.geoadd(this.GEO_KEY, lon, lat, userId);

    // 3. Update DB coordinates for permanent record
    await prisma.user.update({
      where: { id: userId },
      data: { lat, lon }
    });

    return true;
  }

  /**
   * Finds users within a specific radius using Redis Geosearch
   */
  static async findNearby(userId: string, lon: number, lat: number, radiusMeters = 500) {
    // 1. Get IDs from Redis (Distance in meters)
    const nearbyResults = await redis.geosearch(
      this.GEO_KEY, 
      'FROMLONLAT', lon, lat, 
      'BYRADIUS', radiusMeters, 'm', 
      'WITHDIST', 'ASC'
    ) as [string, string][];

    if (!nearbyResults || nearbyResults.length === 0) return [];

    // 2. Filter out self and build ID list
    const distanceMap = new Map<string, number>();
    const nearbyIds: string[] = [];

    for (const [id, dist] of nearbyResults) {
      if (id !== userId) {
        nearbyIds.push(id);
        distanceMap.set(id, parseFloat(dist));
      }
    }

    if (nearbyIds.length === 0) return [];

    // 3. Fetch full profiles from Postgres
    const profiles = await prisma.user.findMany({
      where: { 
        id: { in: nearbyIds },
        driftMode: false // Double safety check
      },
      select: { 
        id: true, 
        displayName: true, 
        bio: true, 
        spotifyTopGenres: true,
        interests: true
      }
    });

    // 4. Enrich profiles with the exact distance from Redis
    return profiles.map(profile => ({
      ...profile,
      distanceMeters: Math.round(distanceMap.get(profile.id) || 0)
    }));
  }

  static async removeLocation(userId: string) {
    await redis.zrem(this.GEO_KEY, userId);
  }
}
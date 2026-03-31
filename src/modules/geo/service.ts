import { redis } from '../../db/redis.js';
import { prisma } from '../../db/prisma.js';

export class GeoService {
  private static GEO_KEY = 'zync:live_locations';

  // O(log(N)) operation - Blazing fast geospatial indexing
  static async updateLocation(userId: string, lon: number, lat: number) {
    // 1. Check if user is in Drift Mode. If they are, they don't get added to the map.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { driftMode: true }
    });
    
    if (user?.driftMode) {
      // If invisible, scrub them from Redis immediately just in case
      await redis.zrem(this.GEO_KEY, userId);
      return false;
    }

    // 2. Add/Update location in Redis Geohash
    await redis.geoadd(this.GEO_KEY, lon, lat, userId);
    return true;
  }

  // O(N+log(M)) operation - Highly optimized radial search
  static async findNearby(userId: string, lon: number, lat: number, radiusMeters = 500) {
    // 1. Ask Redis for all user IDs within the radius. 
    // We use 'WITHDIST' to return the distance in meters alongside the ID.
    const nearbyResults = await redis.geosearch(
      this.GEO_KEY, 
      'FROMLONLAT', lon, lat, 
      'BYRADIUS', radiusMeters, 'm', 
      'WITHDIST', 'ASC'
    ) as [string, string][]; // Returns tuple: [userId, distanceInMeters]

    if (!nearbyResults || nearbyResults.length === 0) return [];

    // 2. Filter out the user making the request and format a fast lookup map
    const distanceMap = new Map<string, number>();
    const nearbyIds: string[] = [];

    for (const [id, distanceStr] of nearbyResults) {
      if (id !== userId) {
        nearbyIds.push(id);
        distanceMap.set(id, parseFloat(distanceStr));
      }
    }

    if (nearbyIds.length === 0) return [];

    // 3. Fetch the public profiles from PostgreSQL for those specific IDs
    // We explicitly filter out driftMode: true as a secondary safety net
    const profiles = await prisma.user.findMany({
      where: { 
        id: { in: nearbyIds }, 
        driftMode: false 
      },
      select: { 
        id: true, 
        displayName: true, 
        bio: true, 
        spotifyGenres: true 
      }
    });

    // 4. Merge the DB profiles with the exact distance from Redis
    const enrichedProfiles = profiles.map(profile => ({
      ...profile,
      distanceMeters: Math.round(distanceMap.get(profile.id) || 0)
    }));

    return enrichedProfiles;
  }

  // Scrub a user from the map completely (used during logout or disconnects)
  static async removeLocation(userId: string) {
    await redis.zrem(this.GEO_KEY, userId);
  }
}
import { prisma } from '../../db/prisma.js';

// Define a proper interface for the User object
interface MatchUser {
  id: string;
  lat: number;
  lon: number;
  spotifyTopGenres: string[];
  interests: string[];
}
export interface MatchResult {
  id: string;
  displayName: string;
  avatarUrl: string;
  totalMatchScore: number;
  distanceMeters: number;
}

export class RecommendationEngine {
  static async computeHighFidelityMatches(user: MatchUser, limit = 10) {
    /**
     * SCIENCE NOTE: 
     * 1 degree of Lat is always ~111.1km.
     * 1 degree of Lon depends on the Latitude: 111.1 * cos(lat).
     * We use a "Local Flat Earth" approximation with a Cosine factor for ultra-fast, 
     * high-precision results within city-wide scales.
     */
    
    const matches = await prisma.$queryRaw`
      WITH ScoredUsers AS (
        SELECT 
          u.id, 
          u."displayName", 
          u."avatarUrl",
          u.lat,
          u.lon,
          u.bio,
          
          -- 1. Music Score (10 pts per shared genre, max 40)
          -- Uses cardinality/intersect for exact overlap counting
          LEAST(40, (
            SELECT COUNT(*) FROM (
              SELECT UNNEST(u."spotifyTopGenres") 
              INTERSECT 
              SELECT UNNEST(${user.spotifyTopGenres}::text[])
            ) AS shared_genres
          ) * 10) AS music_score,
          
          -- 2. Interest Score (10 pts per shared interest, max 30)
          LEAST(30, (
            SELECT COUNT(*) FROM (
              SELECT UNNEST(u."interests") 
              INTERSECT 
              SELECT UNNEST(${user.interests}::text[])
            ) AS shared_interests
          ) * 10) AS interest_score,

          -- 3. High-Precision Distance Score (Max 30 points)
          -- We apply the Cosine correction to the Longitude for accurate 'nearby' math
          -- SQRT( (Δlat * 111)^2 + (Δlon * 111 * cos(lat))^2 )
          GREATEST(0, 30 - (
            SQRT(
              POWER((u.lat - ${user.lat}) * 111.1, 2) + 
              POWER((u.lon - ${user.lon}) * 111.1 * COS(RADIANS(${user.lat})), 2)
            ) * 5 -- Penalty multiplier: Drops to 0 points at 6km away
          )) AS distance_score

        FROM "User" u
        WHERE u.id != ${user.id}
          AND u."driftMode" = false
          -- GEOSPATIAL FILTER: Only look at users within a ~10km bounding box first (Index friendly)
          AND u.lat BETWEEN ${user.lat} - 0.1 AND ${user.lat} + 0.1
          AND u.lon BETWEEN ${user.lon} - 0.1 AND ${user.lon} + 0.1
      )
      SELECT 
        id, 
        "displayName", 
        "avatarUrl", 
        (music_score + interest_score + distance_score) AS "totalMatchScore",
        -- Distance in meters for the UI
        (SQRT(
          POWER((lat - ${user.lat}) * 111100, 2) + 
          POWER((lon - ${user.lon}) * 111100 * COS(RADIANS(${user.lat})), 2)
        )) AS "distanceMeters"
      FROM ScoredUsers
      WHERE (music_score + interest_score + distance_score) >= 35 -- Adjusted threshold
      ORDER BY "totalMatchScore" DESC
      LIMIT ${limit};
    `;

    return matches;
  }
}
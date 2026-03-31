import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../db/prisma.js';

export class SearchController {
  static async globalSearch(request: FastifyRequest, reply: FastifyReply) {
    // Internal casting to resolve the Fastify type mismatch
    const { q } = request.query as { q?: string };

    // 1. Guard Clause: Don't hit the DB for tiny or empty strings
    if (!q || q.trim().length < 2) {
      return reply.send({ success: true, data: { users: [], posts: [] } });
    }

    const searchTerm = q.trim();

    try {
      // 2. Parallel Execution for MAANG-grade latency
      const [users, posts] = await Promise.all([
        // USER SEARCH: Matches Name, Bio, or Spotify Genres
        prisma.user.findMany({
          where: {
            driftMode: false,
            OR: [
              { displayName: { contains: searchTerm, mode: 'insensitive' } },
              { bio: { contains: searchTerm, mode: 'insensitive' } },
              { spotifyTopGenres: { has: searchTerm } }
            ]
          },
          select: { 
            id: true, 
            displayName: true, 
            avatarUrl: true, 
            bio: true,
            spotifyTopGenres: true 
          },
          take: 10
        }),

        // POST SEARCH: Matches content
        prisma.post.findMany({
          where: {
            content: { contains: searchTerm, mode: 'insensitive' }
          },
          include: {
            author: { 
              select: { id: true, displayName: true, avatarUrl: true } 
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 15
        })
      ]);

      return reply.send({ 
        success: true, 
        data: { users, posts },
        meta: { query: searchTerm, timestamp: new Date() }
      });
      
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Search failed' });
    }
  }
}
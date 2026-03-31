import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../db/prisma.js';

export class StoryController {
  /**
   * 📸 Create a Story (24-hour TTL)
   */
  static async createStory(request: FastifyRequest, reply: FastifyReply) {
    const authorId = request.user.id;
    // Internal casting to satisfy strict TypeScript rules
    const { mediaUrl } = request.body as { mediaUrl: string };

    if (!mediaUrl) {
      return reply.status(400).send({ error: 'mediaUrl is required' });
    }

    // 1. Precise 24-hour expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const story = await prisma.story.create({
      data: { 
        mediaUrl, 
        authorId, 
        expiresAt 
      }
    });

    return reply.status(201).send({ success: true, data: story });
  }

  /**
   *  Get Active Stories (Personalized Feed)
   */
  static async getActiveStories(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id;

    const stories = await prisma.story.findMany({
      where: {
        expiresAt: { gt: new Date() },
        OR: [
          // 1. Own stories
          { authorId: userId },
          // 2. Stories from people who ACCEPTED your request
          {
            author: {
              receivedRequests: {
                some: { senderId: userId, status: 'ACCEPTED' }
              }
            }
          },
          // 3. Stories from people whose request YOU accepted
          {
            author: {
              sentRequests: {
                some: { receiverId: userId, status: 'ACCEPTED' }
              }
            }
          }
        ]
      },
      include: {
        author: { 
          select: { id: true, displayName: true, avatarUrl: true } 
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ success: true, data: stories });
  }
}
import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { getPagination } from '../../lib/pagination.js';

export class PostController {
  /**
   * GET /api/v1/posts/feed
   * Fetches posts from the user and their accepted connections using Cursor Pagination
   */
  static async getFeed(
    request: FastifyRequest<{ Querystring: { cursor?: string; limit?: string } }>, 
    reply: FastifyReply
  ) {
    const userId = request.user.id;
    const { cursor } = request.query;
    const limit = parseInt(request.query.limit || '10');

    try {
      const posts = await prisma.post.findMany({
        where: {
          author: {
            OR: [
              { id: userId }, // My posts
              { receivedRequests: { some: { senderId: userId, status: 'ACCEPTED' } } },
              { sentRequests: { some: { receiverId: userId, status: 'ACCEPTED' } } }
            ]
          }
        },
        include: {
          author: {
            select: { 
              displayName: true, 
              avatarUrl: true 
            }
          }
        },
        // Spread the utility function results directly into the query
        ...getPagination(cursor, limit)
      });

      // Type-safe next cursor calculation using Optional Chaining
      const nextCursor = posts.length === limit 
        ? posts[posts.length - 1]?.id 
        : null;

      return reply.send({
        success: true,
        data: posts,
        nextCursor
      });
    } catch (error) {
      console.error('Feed Error:', error);
      return reply.status(500).send({ success: false, error: "Failed to fetch feed." });
    }
  }

  /**
   * POST /api/v1/posts/create
   * Creates a new post for the logged-in user
   */
  static async create(
    request: FastifyRequest<{ Body: { content: string; imageUrl?: string } }>,
    reply: FastifyReply
  ) {
    const userId = request.user.id;
    const { content, imageUrl } = request.body;

    if (!content || content.trim().length === 0) {
      return reply.status(400).send({ success: false, error: "Post content cannot be empty." });
    }

    try {
      const newPost = await prisma.post.create({
        data: {
          content,
          // ✨ FIX: If imageUrl is undefined, pass null.
          imageUrl: imageUrl ?? null, 
          authorId: userId
        },
        include: {
          author: {
            select: { displayName: true, avatarUrl: true }
          }
        }
      });

      return reply.status(201).send({ success: true, data: newPost });
    } catch (error) {
      console.error('Create Post Error:', error);
      return reply.status(500).send({ success: false, error: "Failed to create post." });
    }
  }
}
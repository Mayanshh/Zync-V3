import type { FastifyInstance } from 'fastify';
import { PostController } from './controller.js';
import { authGuard } from '../../middleware/auth.guard.js';

export async function postRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authGuard);

  // GET /api/v1/posts/feed?limit=10&cursor=some-uuid
  app.get('/feed', PostController.getFeed);
}
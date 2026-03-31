// Add 'type' here to satisfy verbatimModuleSyntax
import type { FastifyInstance } from 'fastify';
import { UserController } from './controller.js';
import { authGuard } from '../../middleware/auth.guard.js';

export async function userRoutes(app: FastifyInstance) {
  // Apply auth guard to all routes in this plugin
  app.addHook('preHandler', authGuard);

  app.get('/me', UserController.getProfile);
  app.put('/me', UserController.updateProfile);
  app.post('/drift', UserController.toggleDriftMode);
}
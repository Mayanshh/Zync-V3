import type { FastifyInstance } from 'fastify';
import { ConnectionController } from './controller.js';
import { authGuard } from '../../middleware/auth.guard.js';

export async function connectionRoutes(app: FastifyInstance) {
  // Every route in this file requires a valid Access Token
  app.addHook('preHandler', authGuard);

  // POST: Send a connection request
  app.post('/request', ConnectionController.sendRequest);

  // PATCH: Accept a pending request (e.g., /api/v1/connections/accept/some-uuid)
  app.patch('/accept/:id', ConnectionController.acceptRequest);
  
  // GET: Optional - List all pending requests for the logged-in user
  // app.get('/pending', ConnectionController.getPendingRequests); 
}
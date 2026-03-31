import type { FastifyInstance } from 'fastify';
import { GeoController } from './controller.js';
import { authGuard } from '../../middleware/auth.guard.js';

export async function geoRoutes(app: FastifyInstance) {
  // Protect all geo endpoints
  app.addHook('preHandler', authGuard);

  // POST: Send exact GPS coords to the server
  app.post('/ping', GeoController.pingLocation);
  
  // GET: Retrieve users within 500m (e.g. /api/v1/geo/nearby?lon=-122.4&lat=37.7&radius=500)
  app.get('/nearby', GeoController.getNearbyUsers);
}
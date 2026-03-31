import type { FastifyRequest, FastifyReply } from 'fastify';
import { GeoService } from './service.js';

export class GeoController {
  static async pingLocation(
    request: FastifyRequest<{ Body: { lon: number; lat: number } }>, 
    reply: FastifyReply
  ) {
    try {
      const { lon, lat } = request.body;
      const isVisible = await GeoService.updateLocation(request.user.id, lon, lat);
      
      return reply.status(200).send({ 
        success: true, 
        message: isVisible ? 'Location updated' : 'Location suppressed (Drift Mode Active)' 
      });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: 'Failed to update location' });
    }
  }

  static async getNearbyUsers(
    request: FastifyRequest<{ Querystring: { lon: string; lat: string; radius?: string } }>, 
    reply: FastifyReply
  ) {
    try {
      const lon = parseFloat(request.query.lon);
      const lat = parseFloat(request.query.lat);
      const radius = request.query.radius ? parseInt(request.query.radius, 10) : 500;

      if (isNaN(lon) || isNaN(lat)) {
        return reply.status(400).send({ success: false, error: 'Invalid coordinates' });
      }

      const nearby = await GeoService.findNearby(request.user.id, lon, lat, radius);
      
      return reply.status(200).send({ success: true, data: nearby });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: 'Failed to scan proximity network' });
    }
  }
}
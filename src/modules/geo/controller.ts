import type { FastifyRequest, FastifyReply } from 'fastify';
import { GeoService } from './service.js';
// 1. Import your custom metrics
import { nearbySearchCounter } from '../../config/monitoring.js';
import client from 'prom-client';

// 2. Create a Histogram to track search latency (P99 monitoring)
const proximityScanLatency = new client.Histogram({
  name: 'zync_geo_scan_duration_seconds',
  help: 'Duration of proximity scans in seconds',
  buckets: [0.01, 0.05, 0.1, 0.5, 1], // Tracking 10ms to 1s
});

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
    // 🚀 Start the timer for Prometheus
    const endTimer = proximityScanLatency.startTimer();

    try {
      const lon = parseFloat(request.query.lon);
      const lat = parseFloat(request.query.lat);
      const radius = request.query.radius ? parseInt(request.query.radius, 10) : 500;

      if (isNaN(lon) || isNaN(lat)) {
        return reply.status(400).send({ success: false, error: 'Invalid coordinates' });
      }

      const nearby = await GeoService.findNearby(request.user.id, lon, lat, radius);
      
      // 📈 Increment the counter for every successful search
      nearbySearchCounter.inc();
      
      // ⏱️ Stop the timer and record the latency
      endTimer();

      return reply.status(200).send({ success: true, data: nearby });
    } catch (error: any) {
      // Still end the timer even on error to track "Failed Scan" latency
      endTimer();
      return reply.status(500).send({ success: false, error: 'Failed to scan proximity network' });
    }
  }
}
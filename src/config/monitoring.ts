import client from 'prom-client';

// 1. Unified Registry
export const register = new client.Registry();

// 2. Default System Metrics (CPU, RAM, Event Loop)
client.collectDefaultMetrics({ register });

// --- CUSTOM ZYNC METRICS ---

/** * HTTP Traffic: Tracks volume, routes, and error rates 
 */
export const httpRequestsTotal = new client.Counter({
  name: 'zync_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

/** * Real-time Sockets: Tracks active user density 
 */
export const activeWebSockets = new client.Gauge({
  name: 'zync_active_websockets',
  help: 'Number of currently active WebSocket connections',
});

/** * Business Logic: Tracks how often people use the "Nearby" feature 
 */
export const nearbySearchCounter = new client.Counter({
  name: 'zync_nearby_searches_total',
  help: 'Total count of proximity searches performed',
});

/** * Performance: Tracks API latency for P99 monitoring 
 */
export const apiResponseTime = new client.Histogram({
  name: 'zync_api_response_time_seconds',
  help: 'Response time in seconds for API endpoints',
  labelNames: ['route'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5], // 10ms to 5s
});

// 3. Register all custom metrics
register.registerMetric(httpRequestsTotal);
register.registerMetric(activeWebSockets);
register.registerMetric(nearbySearchCounter);
register.registerMetric(apiResponseTime);
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';
import metricsPlugin from 'fastify-metrics';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

// 1. Background Jobs, Config & DB
import './jobs/notification.worker.js'; 
import { env } from './config/env.js';
import { redis } from './db/redis.js';
import { register } from './config/monitoring.js';

// 2. Middleware & Error Handling
import { authGuard } from './middleware/auth.guard.js';
import { globalErrorHandler } from './middleware/error.handler.js';

// 3. Service & Controller Imports
import { UserService } from './modules/users/service.js';
import { StoryController } from './modules/stories/controller.js';
import { SearchController } from './modules/search/controller.js';

// 4. Module Route Imports
import { authRoutes } from './modules/auth/routes.js';
import { userRoutes } from './modules/users/routes.js';
import { geoRoutes } from './modules/geo/routes.js';
import { connectionRoutes } from './modules/connections/routes.js';
import { postRoutes } from './modules/posts/routes.js';
import { mediaRoutes } from './modules/media/routes.js';

// 5. Real-time Engine
import { initSockets } from './sockets/io.js';

const app = Fastify({ 
  logger: true,
  // Increase connection timeout for slow mobile networks
  connectionTimeout: 30000 
});

async function bootstrap() {
  try {
    // --- 1. COMPILER SETUP (Zod Type Safety) ---
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    // --- 2. GLOBAL ERROR CATCHER ---
    app.setErrorHandler(globalErrorHandler);

    // --- 3. SECURITY & PLUGINS ---
    await app.register(helmet);
    await app.register(cors, { origin: env.FRONTEND_URL || '*' }); 
    await app.register(fastifyCookie, { secret: env.JWT_SECRET });

    // --- 4. DISTRIBUTED RATE LIMITING (Redis-backed) ---
    await app.register(fastifyRateLimit, {
      max: 100,
      timeWindow: '1 minute',
      redis: redis,
      keyGenerator: (req) => (req.headers['x-forwarded-for'] as string) || req.ip
    });

    // --- 5. MULTIPART (File Uploads) ---
    await app.register(fastifyMultipart, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB strict limit
        files: 1
      }
    });

    // --- 6. MONITORING (Prometheus/Grafana) ---
    await app.register(metricsPlugin as any, { 
      endpoint: '/metrics', 
      registry: register,
      defaultMetrics: { enabled: true }
    });

    // --- 7. MODULE ROUTE REGISTRATION ---
    await app.register(authRoutes, { prefix: '/api/v1/auth' });
    await app.register(userRoutes, { prefix: '/api/v1/users' });
    await app.register(geoRoutes, { prefix: '/api/v1/geo' });
    await app.register(connectionRoutes, { prefix: '/api/v1/connections' });
    await app.register(postRoutes, { prefix: '/api/v1/posts' });
    await app.register(mediaRoutes, { prefix: '/api/v1/media' });

    // --- 8. STORY & SEARCH ENDPOINTS ---
    app.post('/api/v1/stories', { preHandler: [authGuard] }, StoryController.createStory);
    app.get('/api/v1/stories/active', { preHandler: [authGuard] }, StoryController.getActiveStories);
    app.get('/api/v1/search', { preHandler: [authGuard] }, SearchController.globalSearch);

    // --- 9. DISCOVERY (Spotify Similarity Suggestions) ---
    app.get('/api/v1/users/suggestions', { preHandler: [authGuard] }, async (req, res) => {
      const suggestions = await UserService.getSuggestions(req.user.id);
      return res.send({ success: true, data: suggestions });
    });

    // --- 10. HEALTH CHECK ---
    app.get('/health', async () => {
      return { 
        status: 'Zync Core Online', 
        redis: redis.status,
        uptime: process.uptime(),
        timestamp: new Date()
      };
    });

    // --- 11. INITIALIZE SOCKETS & START SERVER ---
    initSockets(app.server);

    const port = Number(env.PORT) || 8080;
    await app.listen({ port, host: '0.0.0.0' });
    
    console.log(`\n🚀 Zync Production Core Ready`);
    console.log(`📊 Metrics: http://localhost:${port}/metrics`);
    console.log(`🏥 Health: http://localhost:${port}/health`);

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Global Redis Error Handling
redis.on('error', (err) => console.error('CRITICAL: Redis Connection Failed:', err.message));

bootstrap();
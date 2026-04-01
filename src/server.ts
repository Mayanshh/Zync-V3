import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';
import metricsPlugin from 'fastify-metrics';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
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
  // 20MB = 20 * 1024 * 1024 bytes
  bodyLimit: 20971520,
  connectionTimeout: 30000,
});

async function bootstrap() {
  try {
    // --- 1. COMPILER SETUP (Zod Type Safety) ---
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    // --- 2. GLOBAL ERROR CATCHER ---
    app.setErrorHandler(globalErrorHandler);

    // --- 3. SWAGGER SETUP (The "Brain" for AI Testing) ---
    // This generates the documentation/json for Postman/Apidog
    await app.register(fastifySwagger, {
      openapi: {
        info: {
          title: 'Zync API Documentation',
          description: 'MAANG-grade auto-generated docs for AI-driven testing',
          version: '1.0.0',
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
    });

    await app.register(fastifySwaggerUi, {
      routePrefix: '/documentation',
    });

    // --- 4. SECURITY & CORE PLUGINS ---
    await app.register(helmet);
    await app.register(cors, { origin: env.FRONTEND_URL || '*' }); 
    await app.register(fastifyCookie, { secret: env.JWT_SECRET });

    // --- 5. DISTRIBUTED RATE LIMITING ---
    await app.register(fastifyRateLimit, {
      max: 100,
      timeWindow: '1 minute',
      redis: redis,
      keyGenerator: (req) => (req.headers['x-forwarded-for'] as string) || req.ip
    });

    // --- 6. MULTIPART (File Uploads) ---
    await app.register(fastifyMultipart, {
      limits: {
        fileSize: 20971520,
        files: 1
      }
    });

    // --- 7. MONITORING (Prometheus) ---
    await app.register(metricsPlugin as any, { 
      endpoint: '/metrics', 
      registry: register,
      defaultMetrics: { enabled: true }
    });

    // --- 8. MODULE ROUTE REGISTRATION ---
    await app.register(authRoutes, { prefix: '/api/v1/auth' });
    await app.register(userRoutes, { prefix: '/api/v1/users' });
    await app.register(geoRoutes, { prefix: '/api/v1/geo' });
    await app.register(connectionRoutes, { prefix: '/api/v1/connections' });
    await app.register(postRoutes, { prefix: '/api/v1/posts' });
    await app.register(mediaRoutes, { prefix: '/api/v1/media' });

    // --- 9. STORY & SEARCH ENDPOINTS ---
    app.post('/api/v1/stories', { preHandler: [authGuard] }, StoryController.createStory);
    app.get('/api/v1/stories/active', { preHandler: [authGuard] }, StoryController.getActiveStories);
    app.get('/api/v1/search', { preHandler: [authGuard] }, SearchController.globalSearch);

    // --- 10. DISCOVERY SUGGESTIONS ---
    app.get('/api/v1/users/suggestions', { preHandler: [authGuard] }, async (req, res) => {
      const suggestions = await UserService.getSuggestions(req.user.id);
      return res.send({ success: true, data: suggestions });
    });

    // --- 11. HEALTH CHECK ---
    app.get('/health', async () => {
      return { 
        status: 'Zync Core Online', 
        redis: redis.status,
        uptime: process.uptime(),
        timestamp: new Date()
      };
    });

    // --- 12. INITIALIZE SOCKETS & START SERVER ---
    initSockets(app.server);

    const port = Number(env.PORT) || 8080;
    await app.listen({ port, host: '0.0.0.0' });
    
    console.log(`\n Zync Infrastructure Ready`);
    console.log(` Docs: http://localhost:${port}/documentation`);
    console.log(` AI JSON: http://localhost:${port}/documentation/json \n`);

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Global Redis Error Handling
redis.on('error', (err) => console.error('CRITICAL: Redis Connection Failed:', err.message));

bootstrap();
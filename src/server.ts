import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { redis } from './db/redis.js';
import { userRoutes } from './modules/users/routes.js';
import { geoRoutes } from './modules/geo/routes.js';
import { initSockets } from './sockets/io.js';

// Initialize Fastify with built-in logging
const app = Fastify({ 
  logger: true 
});

async function bootstrap() {
  try {
    // 1. Security Layer
    // Helmet helps secure your apps by setting various HTTP headers
    await app.register(helmet);
    // CORS is set to '*' for development; update this to your frontend URL in production
    await app.register(cors, { origin: '*' }); 

    // 2. Register REST API Routes
    await app.register(userRoutes, { prefix: '/api/v1/users' });
    await app.register(geoRoutes, { prefix: '/api/v1/geo' });

    // 3. Health Check Route
    app.get('/health', async () => {
      // Monitor Redis status in the health check
      const redisStatus = redis.status === 'ready' ? 'Connected' : 'Disconnected';
      return { 
        status: 'Zync Core Online', 
        redis: redisStatus,
        uptime: process.uptime() 
      };
    });

    // 4. Initialize WebSockets 
    // We pass app.server (the underlying Node.js HTTP server) to the Socket.io initializer
    initSockets(app.server);

    // 5. Start Listening
    const port = Number(env.PORT) || 8080;
    await app.listen({ port, host: '0.0.0.0' });
    
    console.log(`\n Zync Backend fully operational on port ${port}`);
    console.log(` Health Check: http://localhost:${port}/health`);

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Global error handling for the Redis connection to prevent silent failures
redis.on('error', (err) => {
  console.error('CRITICAL: Redis Connection Failed:', err.message);
});

// Run the bootstrap function
bootstrap();
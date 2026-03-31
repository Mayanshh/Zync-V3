import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { redis } from '../db/redis.js';
import { env } from '../config/env.js';
import { activeWebSockets } from '../config/monitoring.js';
import { setupHandlers } from './handlers.js';

export let io: Server;

export function initSockets(httpServer: any) {
  io = new Server(httpServer, {
    cors: { 
      origin: env.FRONTEND_URL || '*', 
      methods: ['GET', 'POST'] 
    },
    transports: ['websocket'], // Force pure WebSockets for lower latency
    
    // --- 1. RESILIENCE CONFIG ---
    pingInterval: 25000, 
    pingTimeout: 20000,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // Recover missed packets if disconnected < 2 mins
      skipMiddlewares: true,
    }
  });

  // --- 2. HORIZONTAL SCALING (Redis Adapter) ---
  const subClient = redis.duplicate();
  io.adapter(createAdapter(redis, subClient));

  // --- 3. AUTHENTICATION MIDDLEWARE ---
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Auth error: Token missing'));

      const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; email: string };
      
      // Attach user data to the socket object for use in handlers
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error('Auth error: Invalid token'));
    }
  });

  // --- 4. CONNECTION LOGIC ---
  io.on('connection', (socket) => {
    const userId = socket.data.user.id;
    
    // Increment Monitoring Gauge 📊
    activeWebSockets.inc();
    
    console.log(`⚡ [Socket] User Connected: ${userId} (${socket.id})`);
    
    // Join a private room for targeted events (Direct Messages, Notifications)
    socket.join(`user_room_${userId}`);

    // Heartbeat for frontend heartbeat tracking
    socket.on('client_ping', () => {
      socket.emit('server_pong', { timestamp: Date.now() });
    });

    // Register Handlers (Chat, Discovery, etc.)
    setupHandlers(io, socket);

    socket.on('disconnect', () => {
      activeWebSockets.dec(); // Decrement Monitoring Gauge 📊
      console.log(`🔌 [Socket] User Disconnected: ${userId}`);
    });
  });

  return io;
}
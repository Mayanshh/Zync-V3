import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { redis } from '../db/redis.js';
import { env } from '../config/env.js';
import { handleChatEvents } from './handlers.js';

export function initSockets(httpServer: any) {
  const io = new Server(httpServer, {
    cors: { 
      origin: '*', // In production, replace with your Vercel frontend URL
      methods: ['GET', 'POST'] 
    },
    transports: ['websocket'], // Force pure WebSockets for speed
  });

  // Scale horizontally: This broadcasts socket events across multiple server instances via Redis
  const subClient = redis.duplicate();
  io.adapter(createAdapter(redis, subClient));

  // Authentication Middleware for WebSockets
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      // Verify JWT
      const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; email: string };
      
      // Attach user data directly to the socket connection
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.user.id;
    console.log(`⚡ User connected to WebSocket: ${userId}`);
    
    // Join a unique, private room based on their User ID.
    // This makes routing direct messages incredibly easy.
    socket.join(`user_room_${userId}`);

    // Register all the event listeners (Chat, Location, Drift)
    handleChatEvents(io, socket);

    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected: ${userId}`);
    });
  });

  return io;
}
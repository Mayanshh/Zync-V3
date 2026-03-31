import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// 1. Extend FastifyRequest with the fields we actually need in our controllers
declare module 'fastify' {
  interface FastifyRequest {
    user: { 
      id: string; 
      email: string; 
      driftMode: boolean; // Carried in JWT for zero-DB-latency checks
    };
  }
}

export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized: Missing or invalid token format' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return reply.status(401).send({ error: 'Unauthorized: Token missing' });
    }

    // 2. The "Double Cast" Fix: unknown -> Target Type
    // This resolves the "neither type sufficiently overlaps" TypeScript error
    const decoded = jwt.verify(token, env.JWT_SECRET) as unknown as { 
      id: string; 
      email: string; 
      driftMode: boolean 
    };
    
    // 3. Attach to request - No Database Call Needed! 🚀
    request.user = decoded;
    
  } catch (error) {
    return reply.status(401).send({ error: 'Unauthorized: Token expired or invalid' });
  }
}
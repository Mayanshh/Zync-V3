// 1. Use 'import type' for Fastify objects to satisfy verbatimModuleSyntax
import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Extend FastifyRequest to include our user payload
declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; email: string };
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

    // 2. Cast to 'unknown' first to resolve the "neither type sufficiently overlaps" error
    const decoded = jwt.verify(token, env.JWT_SECRET) as unknown as { id: string; email: string };
    
    request.user = decoded;
  } catch (error) {
    return reply.status(401).send({ error: 'Unauthorized: Token expired or invalid' });
  }
}
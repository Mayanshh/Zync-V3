import type { FastifyRequest, FastifyReply } from 'fastify';
import '@fastify/cookie'; // Required for TypeScript to see .setCookie()
import { prisma } from '../../db/prisma.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

interface RegisterBody {
  email: string;
  password: string;
  displayName: string;
}

interface LoginBody {
  email: string;
  password: string;
}

export class AuthController {
  static async register(request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) {
    const { email, password, displayName } = request.body;

    // 1. Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return reply.status(400).send({ success: false, error: 'Email already registered' });
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Create user
    await prisma.user.create({
      data: { email, password: hashedPassword, displayName }
    });

    return reply.status(201).send({ success: true, message: 'User created successfully' });
  }

  static async login(request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) {
    const { email, password } = request.body;
    
    const user = await prisma.user.findUnique({ where: { email } });

    // 1. Validate Credentials
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return reply.status(401).send({ success: false, error: 'Invalid credentials' });
    }

    // 2. Generate Tokens
    const accessToken = jwt.sign({ id: user.id }, env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: user.id }, env.REFRESH_SECRET, { expiresIn: '7d' });

    // 3. Store Refresh Token in DB for rotation/revocation
    await prisma.refreshToken.create({
      data: { 
        token: refreshToken, 
        userId: user.id, 
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
      }
    });

    // 4. Send Refresh Token as HttpOnly Cookie
    // We set secure: false on localhost so Postman/Browsers accept the cookie without HTTPS
    const isProduction = process.env.NODE_ENV === 'production';

    reply.setCookie('refreshToken', refreshToken, {
      path: '/',
      httpOnly: true,
      secure: isProduction, 
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 // 7 days in seconds
    });

    return reply.send({ 
      success: true, 
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName
      }
    });
  }
}
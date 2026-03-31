import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

export function globalErrorHandler(
  error: FastifyError, 
  request: FastifyRequest, 
  reply: FastifyReply
) {
  // 1. Production Logging: Attach Request ID for easy debugging 🔍
  request.log.error({ 
    err: error, 
    url: request.url, 
    id: request.id // Unique ID for every request
  }, 'Global Exception Caught');

  // 2. Handle Zod / Fastify Validation Errors
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: 'Validation Failed',
      details: error.validation.map(err => ({
        path: err.instancePath,
        message: err.message
      }))
    });
  }

  // 3. Handle Prisma Errors (Database Layer)
  // P2002 = Unique constraint (Email/Username already exists)
  if (error.code === 'P2002') {
    return reply.status(409).send({
      success: false,
      error: 'Conflict: This record already exists.'
    });
  }

  // 4. Handle Multipart / Upload Errors (File too large, etc.)
  if (error.code === 'FST_REQ_FILE_TOO_LARGE') {
    return reply.status(413).send({
      success: false,
      error: 'File is too large. Limit is 10MB.'
    });
  }

  // 5. Handle Rate Limiting (429)
  if (error.statusCode === 429) {
    return reply.status(429).send({
      success: false,
      error: 'Too many requests. Please slow down.'
    });
  }

  // 6. Generic Fallback: Hide internal logic for 500 errors 🛡️
  const statusCode = error.statusCode || 500;
  const isInternal = statusCode >= 500;
  
  const safeMessage = isInternal 
    ? 'An unexpected error occurred. Our engineers are on it.' 
    : error.message;

  return reply.status(statusCode).send({
    success: false,
    error: safeMessage,
    // Only show stack trace in development mode
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
}
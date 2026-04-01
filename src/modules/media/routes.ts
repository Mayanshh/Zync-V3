import type { FastifyInstance } from 'fastify';
import { StorageService } from '../../services/storage/cloudinary.js';
import { authGuard } from '../../middleware/auth.guard.js';

export async function mediaRoutes(app: FastifyInstance) {
  app.post(
    '/upload',
    { preHandler: [authGuard] },
    async (request, reply) => {
      // 1. Set limit to 20MB (20 * 1024 * 1024)
      const data = await request.file({ 
        limits: { fileSize: 20 * 1024 * 1024 } 
      });
      
      if (!data) {
        return reply.status(400).send({ success: false, error: 'No file uploaded' });
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({ success: false, error: 'Invalid file type.' });
      }

      try {
        const buffer = await data.toBuffer();
        
        // 2. Pass buffer AND mimetype to the service
        const folderPath = `zync_users/${request.user.id}`;
        const secureUrl = await StorageService.uploadBuffer(buffer, folderPath, data.mimetype);

        return reply.status(201).send({ 
          success: true, 
          url: secureUrl,
          mimetype: data.mimetype === 'video/mp4' ? 'video/mp4' : 'image/avif' // Reflect the conversion
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ success: false, error: 'Upload failed.' });
      }
    }
  );
}
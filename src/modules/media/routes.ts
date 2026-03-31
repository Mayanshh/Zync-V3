import type { FastifyInstance } from 'fastify';
import { StorageService } from '../../services/storage/cloudinary.js';
import { authGuard } from '../../middleware/auth.guard.js';
import '@fastify/multipart';

export async function mediaRoutes(app: FastifyInstance) {
  app.post(
    '/upload',
    { preHandler: [authGuard] },
    async (request, reply) => {
      // 1. Process the multipart form data with a 10MB limit
      const data = await request.file({ limits: { fileSize: 10 * 1024 * 1024 } });
      
      if (!data) {
        return reply.status(400).send({ success: false, error: 'No file uploaded' });
      }

      // 2. Security: Verify it's an image/video
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({ success: false, error: 'Invalid file type. Only JPEG, PNG, WebP, and MP4/MOV are allowed.' });
      }

      try {
        // 3. Convert stream to buffer
        const buffer = await data.toBuffer();
        
        // 4. Upload directly to Cloudinary (Folder: zync_users/USER_ID)
        const folderPath = `zync_users/${request.user.id}`;
        const secureUrl = await StorageService.uploadBuffer(buffer, folderPath);

        return reply.status(201).send({ 
          success: true, 
          url: secureUrl,
          mimetype: data.mimetype 
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ success: false, error: 'Upload to cloud storage failed.' });
      }
    }
  );
}
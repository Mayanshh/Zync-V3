import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';

// 1. Cloudinary Configuration
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export class StorageService {
  /**
   * Uploads a file buffer directly to Cloudinary.
   * resource_type: 'auto' handles both Images and Videos (Stories).
   */
  static async uploadBuffer(fileBuffer: Buffer, folder: string = 'zync_uploads'): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder, 
          resource_type: 'auto',
          fetch_format: 'auto', // Optimization: Serves WebP/Avif automatically
          quality: 'auto'      // Optimization: Compresses without losing visual quality
        },
        (error, result) => {
          if (error || !result) {
            console.error('Cloudinary Upload Error:', error);
            return reject(new Error('Failed to upload media to cloud storage.'));
          }
          resolve(result.secure_url);
        }
      );
      
      uploadStream.end(fileBuffer);
    });
  }

  /**
   * Deletes a file from Cloudinary (Useful for expired stories)
   */
  static async deleteFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.error('Cloudinary Delete Error:', err);
    }
  }
}
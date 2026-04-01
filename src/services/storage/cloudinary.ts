import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';
import sharp from 'sharp'; // Import sharp

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export class StorageService {
  static async uploadBuffer(
    fileBuffer: Buffer, 
    folder: string = 'zync_uploads',
    mimetype: string // Added mimetype parameter
  ): Promise<string> {
    
    let processedBuffer = fileBuffer;

    // --- ULTRA EFFICIENT COMPRESSION FOR IMAGES ---
    if (mimetype.startsWith('image/')) {
      processedBuffer = await sharp(fileBuffer)
        .resize({ width: 1920, withoutEnlargement: true }) // Keep it 1080p+ High Res
        .avif({ quality: 60, effort: 6 }) // AVIF is ~30% better than WebP
        .toBuffer();
    }

    return new Promise((resolve, reject) => {
  // 1. Build the options object dynamically
  const uploadOptions: any = {
    folder,
    resource_type: 'auto',
    // We only add the 'format' key if it's an image
    ...(mimetype.startsWith('image/') ? { format: 'avif' } : {})
  };

  const uploadStream = cloudinary.uploader.upload_stream(
    uploadOptions,
    (error, result) => {
      if (error || !result) {
        console.error('Cloudinary Error:', error);
        return reject(new Error('Upload failed.'));
      }
      resolve(result.secure_url);
    }
  );

  uploadStream.end(processedBuffer);
});
  }

  static async deleteFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.error('Cloudinary Delete Error:', err);
    }
  }
}
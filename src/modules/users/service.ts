import { prisma } from '../../db/prisma.js';

export class UserService {
  // Fetch a single profile (excluding sensitive data)
  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, bio: true, spotifyGenres: true, driftMode: true, createdAt: true }
    });
    
    if (!user) throw new Error('User not found');
    return user;
  }

  // Update bio or Spotify genres
  static async updateProfile(userId: string, data: { displayName?: string; bio?: string; spotifyGenres?: string[] }) {
    return await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, displayName: true, bio: true, spotifyGenres: true }
    });
  }

  // Toggle Invisibility (Drift Mode)
  static async toggleDriftMode(userId: string, isEnabled: boolean) {
    return await prisma.user.update({
      where: { id: userId },
      data: { driftMode: isEnabled },
      select: { id: true, driftMode: true }
    });
  }
}
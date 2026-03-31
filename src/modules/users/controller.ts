// Add 'type' here to satisfy verbatimModuleSyntax
import type { FastifyRequest, FastifyReply } from 'fastify';
import { UserService } from './service.js';

export class UserController {
  static async getProfile(request: FastifyRequest, reply: FastifyReply) {
    try {
      // request.user.id is available because of our earlier module declaration
      const profile = await UserService.getProfile(request.user.id);
      return reply.status(200).send({ success: true, data: profile });
    } catch (error: any) {
      return reply.status(404).send({ success: false, error: error.message });
    }
  }

  static async updateProfile(
    request: FastifyRequest<{ Body: { displayName?: string; bio?: string; spotifyGenres?: string[] } }>, 
    reply: FastifyReply
  ) {
    try {
      const updatedUser = await UserService.updateProfile(request.user.id, request.body);
      return reply.status(200).send({ success: true, data: updatedUser });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: 'Failed to update profile' });
    }
  }

  static async toggleDriftMode(
    request: FastifyRequest<{ Body: { enabled: boolean } }>, 
    reply: FastifyReply
  ) {
    try {
      const status = await UserService.toggleDriftMode(request.user.id, request.body.enabled);
      return reply.status(200).send({ success: true, data: status });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: 'Failed to toggle Drift Mode' });
    }
  }
}
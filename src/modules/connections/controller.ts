import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../db/prisma.js';
// FIXED: Path matches your Desktop\Zync\backend structure
import { notificationQueue } from '../../lib/bullmq.js'; 

export class ConnectionController {
  static async sendRequest(
    request: FastifyRequest<{ Body: { targetId: string } }>, 
    reply: FastifyReply
  ) {
    const senderId = request.user.id;
    const { targetId } = request.body;

    if (senderId === targetId) {
      return reply.status(400).send({ success: false, error: "You cannot connect with yourself." });
    }

    try {
      const existing = await prisma.connection.findFirst({
        where: {
          OR: [
            { senderId, receiverId: targetId },
            { senderId: targetId, receiverId: senderId }
          ]
        }
      });

      if (existing) {
        return reply.status(400).send({ 
          success: false, 
          error: "A connection request already exists between you two." 
        });
      }

      // 2. Create the pending connection
      const connection = await prisma.connection.create({
        data: {
          senderId,
          receiverId: targetId,
          status: 'PENDING'
        },
        include: {
          receiver: { select: { email: true, displayName: true } },
          sender: { select: { displayName: true } } 
        }
      });

      // 3. ✨ Add to BullMQ Queue (Imported from lib/bullmq.js)
      await notificationQueue.add('sendEmail', {
        email: connection.receiver.email,
        senderName: connection.sender.displayName,
      }, {
        attempts: 3, 
        backoff: { type: 'exponential', delay: 1000 } 
      });

      return reply.status(201).send({ success: true, data: connection });
    } catch (error) {
      console.error('Connection Error:', error);
      return reply.status(500).send({ success: false, error: "Failed to send request." });
    }
  }

  static async acceptRequest(
    request: FastifyRequest<{ Params: { id: string } }>, 
    reply: FastifyReply
  ) {
    const userId = request.user.id;
    const connectionId = request.params.id;

    try {
      const connection = await prisma.connection.findUnique({
        where: { id: connectionId }
      });

      if (!connection || connection.receiverId !== userId) {
        return reply.status(403).send({ 
          success: false, 
          error: "You are not authorized to accept this request." 
        });
      }

      if (connection.status !== 'PENDING') {
        return reply.status(400).send({ 
          success: false, 
          error: `This request is already ${connection.status.toLowerCase()}.` 
        });
      }

      const updated = await prisma.connection.update({
        where: { id: connectionId },
        data: { status: 'ACCEPTED' }
      });

      // Notify the sender that they were accepted
      await notificationQueue.add('pushNotification', {
        userId: connection.senderId,
        message: `Your connection request was accepted!`
      });

      return reply.status(200).send({ success: true, data: updated });
    } catch (error) {
      return reply.status(500).send({ success: false, error: "Failed to accept request." });
    }
  }
}
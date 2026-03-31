import { Server, Socket } from 'socket.io';
import { prisma } from '../db/prisma.js';
import { GeoService } from '../modules/geo/service.js';

export function handleChatEvents(io: Server, socket: Socket) {
  const userId = socket.data.user.id;

  // 1. Live Location Ping (Triggered by frontend every 30-60 seconds)
  socket.on('ping_location', async (data: { lon: number; lat: number }) => {
    try {
      const isVisible = await GeoService.updateLocation(userId, data.lon, data.lat);
      socket.emit('ping_response', { 
        success: true, 
        status: isVisible ? 'Location indexed' : 'Hidden by Drift Mode' 
      });
    } catch (error) {
      socket.emit('ping_response', { success: false, error: 'Failed to update location' });
    }
  });

  // 2. Direct Messaging (Drift Mode Aware)
  socket.on('send_message', async (data: { receiverId: string; text: string }) => {
    try {
      // Security Check: Is the person receiving the message in Drift Mode?
      const receiver = await prisma.user.findUnique({
        where: { id: data.receiverId },
        select: { driftMode: true }
      });

      if (!receiver || receiver.driftMode) {
        return socket.emit('message_error', { error: 'User is currently unreachable (Drift Mode).' });
      }

      // Construct payload
      const messagePayload = {
        senderId: userId,
        text: data.text,
        timestamp: new Date().toISOString()
      };

      // Blast it directly to the receiver's private socket room!
      io.to(`user_room_${data.receiverId}`).emit('receive_message', messagePayload);

      // Acknowledge to the sender that it went through
      socket.emit('message_sent', { success: true });

    } catch (error) {
      socket.emit('message_error', { error: 'Internal system failure sending message' });
    }
  });

  // 3. Instant Drift Mode Toggle
  socket.on('toggle_drift', async (data: { enabled: boolean }) => {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { driftMode: data.enabled }
      });
      
      if (data.enabled) {
        // Scrub them from the spatial grid instantly
        await GeoService.removeLocation(userId);
      }
      
      socket.emit('drift_status', { enabled: data.enabled });
    } catch (error) {
      socket.emit('drift_status_error', { error: 'Failed to update privacy state' });
    }
  });
}
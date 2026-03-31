import { Server, Socket } from 'socket.io';
import { prisma } from '../db/prisma.js';
import { GeoService } from '../modules/geo/service.js';

/**
 * Master Socket Handler: Renamed to match the import in io.ts
 */
export function setupHandlers(io: Server, socket: Socket) {
  const userId = socket.data.user.id;

  // --- 1. LIVE LOCATION PING ---
  // Triggered by frontend every 30-60s to update the "Nearby" map
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

  // --- 2. DIRECT MESSAGING (Scalable Room-Based Routing) ---
  socket.on('send_message', async (data: { receiverId: string; text: string }) => {
    try {
      // Logic: Send to the receiver's private room. 
      // If they are in Drift Mode, we handle that via the API/Service layer 
      // or a quick database check.
      const messagePayload = {
        senderId: userId,
        text: data.text,
        timestamp: new Date().toISOString()
      };

      // Blast to the receiver's room across all server instances (via Redis Adapter)
      io.to(`user_room_${data.receiverId}`).emit('receive_message', messagePayload);

      // Acknowledge the sender
      socket.emit('message_sent', { success: true, receiverId: data.receiverId });

    } catch (error) {
      socket.emit('message_error', { error: 'Internal system failure sending message' });
    }
  });

  // --- 3. INSTANT DRIFT MODE TOGGLE ---
  socket.on('toggle_drift', async (data: { enabled: boolean }) => {
    try {
      // Update DB
      await prisma.user.update({
        where: { id: userId },
        data: { driftMode: data.enabled }
      });
      
      if (data.enabled) {
        // Scrub from Redis spatial grid instantly
        await GeoService.removeLocation(userId);
      }
      
      socket.emit('drift_status', { enabled: data.enabled });
      
      // Notify nearby users or specific rooms if needed
      // io.emit('user_status_change', { userId, driftMode: data.enabled });
      
    } catch (error) {
      socket.emit('drift_status_error', { error: 'Failed to update privacy state' });
    }
  });

  // --- 4. CLEANUP ON DISCONNECT ---
  socket.on('disconnect', () => {
    console.log(`🔌 [Handler] Socket ${socket.id} cleaned up.`);
  });
}
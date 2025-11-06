import { Injectable } from '@nestjs/common';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

@Injectable()
export class LiveKitService {
  private apiKey: string;
  private apiSecret: string;
  private url: string;
  private roomService: RoomServiceClient;

  constructor() {
    this.apiKey = process.env.LIVEKIT_API_KEY || '';
    this.apiSecret = process.env.LIVEKIT_API_SECRET || '';
    this.url = process.env.LIVEKIT_URL || '';
    this.roomService = new RoomServiceClient(this.url, this.apiKey, this.apiSecret);
  }

  async createToken(
    roomName: string,
    participantName: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: participantName,
      // Expose participant display name when available
      // @ts-ignore - name is supported by livekit-server-sdk
      name: (metadata && (metadata.userName || metadata.name)) || 'Guest',
      // Participant attributes for agents to read
      // Newer SDKs support attributes; fall back is harmless if ignored
      // @ts-ignore - attributes may not be in older type defs
      attributes: {
        role: (metadata && (metadata.userRole || metadata.role)) || 'customer',
        businessId: metadata ? (metadata.businessId || metadata.business_id || metadata.business) : undefined,
        userName: metadata ? (metadata.userName || metadata.name) : undefined,
        userEmail: metadata ? (metadata.userEmail || metadata.email) : undefined,
      },
    } as any);

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    return await at.toJwt();
  }

  async createRoom(roomName: string, metadata?: Record<string, any>): Promise<any> {
    try {
      const room = await this.roomService.createRoom({
        name: roomName,
        emptyTimeout: 300,
        maxParticipants: 10,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      });
      return room;
    } catch (error) {
      if (error.message && error.message.includes('already exists')) {
        return { name: roomName, exists: true };
      }
      throw error;
    }
  }

  async deleteRoom(roomName: string): Promise<void> {
    await this.roomService.deleteRoom(roomName);
  }

  /**
   * Attempt to send a data message into a room so agents/participants can
   * receive text-oriented events. This method is defensive: if the underlying
   * RoomServiceClient exposes a sendData or sendDataFrame API we use it; if not,
   * we log and noop.
   */
  async sendRoomData(roomName: string, payload: any): Promise<void> {
    try {
      const json = typeof payload === 'string' ? payload : JSON.stringify(payload);
      // Some versions of the SDK expose `sendData` or `sendDataFrame` on roomService.
      if (typeof (this.roomService as any).sendData === 'function') {
        await (this.roomService as any).sendData(roomName, Buffer.from(json));
      } else if (typeof (this.roomService as any).sendDataFrame === 'function') {
        await (this.roomService as any).sendDataFrame(roomName, Buffer.from(json));
      } else if (typeof (this.roomService as any).send === 'function') {
        // fallback to a generic send if present
        await (this.roomService as any).send(roomName, Buffer.from(json));
      } else {
        // SDK doesn't support server-side data sending in this environment
        // No-op but don't throw so callers can continue.
        // eslint-disable-next-line no-console
        console.warn('LiveKit RoomServiceClient has no sendData API available');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Failed to send room data', err);
    }
  }
}

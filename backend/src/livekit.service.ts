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

  async createToken(roomName: string, participantName: string): Promise<string> {
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: participantName,
    });

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
}

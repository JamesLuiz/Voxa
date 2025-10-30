import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { LiveKitService } from './livekit.service';

@Controller()
export class AppController {
  constructor(private readonly liveKitService: LiveKitService) {}

  @Get('/auth/token')
  async getToken(
    @Query('roomName') roomName: string,
    @Query('participantName') participantName: string,
  ) {
    // Append a small random suffix to the participant identity to avoid
    // participant identity collisions when users reconnect. This prevents
    // stale participant state from blocking a new connection with the same
    // identity.
    const suffix = Math.random().toString(36).slice(2, 7);
    const identity = `${(participantName || 'guest')}-${suffix}`;
    const token = await this.liveKitService.createToken(
      roomName || 'default-room',
      identity,
    );
    return { token, url: process.env.LIVEKIT_URL };
  }

  @Get('/api/livekit/token')
  async getLivekitToken(@Query('role') role: string, @Query('businessId') businessId: string) {
  // Use a unique identity per request to avoid conflicts with previous
  // participants who may not have fully left the room. This helps when
  // users refresh or rejoin quickly.
  const roomName = businessId || 'default-room';
  const baseIdentity = role || 'guest';
  const suffix = Math.random().toString(36).slice(2, 7);
  const identity = `${baseIdentity}-${suffix}`;
  const token = await this.liveKitService.createToken(roomName, identity);
  return { token, serverUrl: process.env.LIVEKIT_URL };
  }

  @Post('/rooms/create')
  async createRoom(
    @Body()
    body: {
      roomName?: string;
      participantName?: string;
      businessId?: string;
      role?: 'owner' | 'customer';
    },
  ) {
    const roomName = body.roomName || `room-${Date.now()}`;
    const participantName = body.participantName || 'guest';

    await this.liveKitService.createRoom(roomName, {
      businessId: body.businessId,
      role: body.role,
    });
    const token = await this.liveKitService.createToken(roomName, participantName);

    return {
      roomName,
      token,
      url: process.env.LIVEKIT_URL,
    };
  }

  @Get('/health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

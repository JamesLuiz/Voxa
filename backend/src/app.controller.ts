import { Controller, Get, Post, Body, Query, Req, Headers } from '@nestjs/common';
import { LiveKitService } from './livekit.service';
import * as jwt from 'jsonwebtoken';

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
  async getLivekitToken(
    @Query('role') role: string,
    @Query('businessId') businessId: string,
    @Headers('authorization') authHeader?: string
  ) {
    // Extract businessId from JWT token if owner and not provided in query
    let extractedBusinessId = businessId;
    if (role === 'owner' && !extractedBusinessId && authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.decode(token) as any;
        if (decoded && decoded.businessId) {
          extractedBusinessId = decoded.businessId;
        }
      } catch (e) {
        // Ignore JWT decode errors
      }
    }

    // Use a unique identity per request to avoid conflicts with previous
    // participants who may not have fully left the room. This helps when
    // users refresh or rejoin quickly.
    const roomName = extractedBusinessId || (role === 'owner' ? 'owner-room' : 'default-room');
    const baseIdentity = role || 'guest';
    const suffix = Math.random().toString(36).slice(2, 7);
    const identity = `${baseIdentity}-${suffix}`;
    
    // Include metadata with role and businessId for agent recognition
    const metadata: Record<string, any> = {
      role: role || 'customer',
    };
    if (extractedBusinessId) {
      metadata.businessId = extractedBusinessId;
    }
    
    // Ensure room exists with metadata
    await this.liveKitService.createRoom(roomName, metadata);
    
    const token = await this.liveKitService.createToken(roomName, identity, metadata);
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

  @Get('/')
  health() {
  return { status: 'ok', message: 'Voxa backend is running', timestamp: new Date().toISOString() };
  }
}

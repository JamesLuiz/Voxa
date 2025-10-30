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
    const token = await this.liveKitService.createToken(
      roomName || 'default-room',
      participantName || 'guest',
    );
    return { token, url: process.env.LIVEKIT_URL };
  }

  @Get('/api/livekit/token')
  async getLivekitToken(@Query('role') role: string, @Query('businessId') businessId: string) {
    const participantName = role || 'guest';
    const roomName = businessId || 'default-room';
    const token = await this.liveKitService.createToken(roomName, participantName);
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

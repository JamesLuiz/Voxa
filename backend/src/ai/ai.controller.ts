import { Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('api/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('owner/chat')
  async ownerChat(@Body() body: { message: string; context?: Record<string, unknown> }) {
    return this.aiService.ownerChat(body);
  }

  @Post('customer/chat')
  async customerChat(@Body() body: { businessId: string; message: string }) {
    return this.aiService.customerChat(body);
  }
}

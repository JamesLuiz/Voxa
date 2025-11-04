import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { OwnerChatDto, CustomerChatDto } from '../dto/ai-chat.dto';

@ApiTags('AI')
@Controller('api/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('owner/chat')
  async ownerChat(@Body() body: OwnerChatDto) {
    return this.aiService.ownerChat(body);
  }

  @Post('customer/chat')
  async customerChat(@Body() body: CustomerChatDto) {
    return this.aiService.customerChat(body);
  }
}

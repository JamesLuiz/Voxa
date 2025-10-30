import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { LiveKitService } from '../livekit.service';

@Module({
  controllers: [AiController],
  providers: [AiService, LiveKitService],
  exports: [AiService],
})
export class AiModule {}

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { LiveKitService } from '../livekit.service';

@Module({
  imports: [HttpModule],
  controllers: [AiController],
  providers: [AiService, LiveKitService],
  exports: [AiService],
})
export class AiModule {}

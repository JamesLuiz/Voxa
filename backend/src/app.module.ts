import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { LiveKitService } from './livekit.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [LiveKitService],
})
export class AppModule {}

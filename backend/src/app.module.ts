import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { LiveKitService } from './livekit.service';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { BusinessModule } from './business/business.module';
import { ConfigModule } from './config/config.module';
import { CrmModule } from './crm/crm.module';
import { TicketsModule } from './tickets/tickets.module';
import { MeetingsModule } from './meetings/meetings.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017/voxa'),
    AuthModule,
    BusinessModule,
    ConfigModule,
    CrmModule,
    TicketsModule,
    MeetingsModule,
    AnalyticsModule,
  AiModule,
  ],
  controllers: [AppController],
  providers: [LiveKitService],
})
export class AppModule {}

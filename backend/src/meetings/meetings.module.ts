import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Meeting, MeetingSchema } from '../schemas/meeting.schema';
import { MeetingsController } from './meetings.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Meeting.name, schema: MeetingSchema }])],
  controllers: [MeetingsController],
})
export class MeetingsModule {}



import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Meeting, MeetingSchema } from '../schemas/meeting.schema';
import { Customer, CustomerSchema } from '../schemas/customer.schema';
import { MeetingsController } from './meetings.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Meeting.name, schema: MeetingSchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
  ],
  controllers: [MeetingsController],
})
export class MeetingsModule {}



import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Customer, CustomerSchema } from '../schemas/customer.schema';
import { Ticket, TicketSchema } from '../schemas/ticket.schema';
import { Meeting, MeetingSchema } from '../schemas/meeting.schema';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: Ticket.name, schema: TicketSchema },
      { name: Meeting.name, schema: MeetingSchema },
    ]),
  ],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}



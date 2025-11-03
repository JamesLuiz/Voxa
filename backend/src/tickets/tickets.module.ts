import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Ticket, TicketSchema } from '../schemas/ticket.schema';
import { TicketsController } from './tickets.controller';
import { Business, BusinessSchema } from '../schemas/business.schema';
import { Customer, CustomerSchema } from '../schemas/customer.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ticket.name, schema: TicketSchema },
      { name: Business.name, schema: BusinessSchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
  ],
  controllers: [TicketsController],
})
export class TicketsModule {}



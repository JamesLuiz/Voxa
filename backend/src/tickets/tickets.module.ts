import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Ticket, TicketSchema } from '../schemas/ticket.schema';
import { TicketsController } from './tickets.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Ticket.name, schema: TicketSchema }])],
  controllers: [TicketsController],
})
export class TicketsModule {}



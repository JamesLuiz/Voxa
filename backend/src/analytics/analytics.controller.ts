import { Controller, Get, Param, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Customer, CustomerDocument } from '../schemas/customer.schema';
import { Ticket, TicketDocument } from '../schemas/ticket.schema';
import { Meeting, MeetingDocument } from '../schemas/meeting.schema';

@Controller('api/analytics')
export class AnalyticsController {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
  ) {}

  @Get('overview')
  async overview(@Query('businessId') businessId: string) {
    const bid = new Types.ObjectId(businessId);
    const [totalCustomers, openTickets, upcomingMeetings, commonQueries] = await Promise.all([
      this.customerModel.countDocuments({ businessId: bid }),
      this.ticketModel.countDocuments({ businessId: bid, status: { $in: ['open', 'in-progress'] } }),
      this.meetingModel.countDocuments({ businessId: bid, startTime: { $gte: new Date() } }),
      Promise.resolve([]),
    ]);
    return { totalCustomers, openTickets, upcomingMeetings, commonQueries };
  }

  @Get('tickets')
  async tickets(@Query('businessId') businessId: string) {
    const bid = new Types.ObjectId(businessId);
    const byStatus = await this.ticketModel.aggregate([
      { $match: { businessId: bid } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    return { byStatus };
  }

  @Get('customers')
  async customers(@Query('businessId') businessId: string) {
    const bid = new Types.ObjectId(businessId);
    const total = await this.customerModel.countDocuments({ businessId: bid });
    return { total };
  }
}



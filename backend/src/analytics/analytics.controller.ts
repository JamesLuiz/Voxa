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

    // Customers count
    const totalCustomersPromise = this.customerModel.countDocuments({ businessId: bid });

    // Ticket counts by status
    const ticketAggPromise = this.ticketModel
      .aggregate([
        { $match: { businessId: bid } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .exec();

    // Upcoming meetings
    const upcomingMeetingsPromise = this.meetingModel.countDocuments({ businessId: bid, startTime: { $gte: new Date() } });

    // Conversation stats: number of conversation entries in last 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const conversationsAggPromise = this.customerModel.aggregate([
      { $match: { businessId: bid } },
      { $unwind: '$conversationHistory' },
      { $match: { 'conversationHistory.timestamp': { $gte: since } } },
      { $count: 'conversations' },
    ]).exec();

    // Top common queries (last 7 days)
    const topSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const commonQueriesPromise = this.customerModel.aggregate([
      { $match: { businessId: bid } },
      { $unwind: '$conversationHistory' },
      { $match: { 'conversationHistory.timestamp': { $gte: topSince } } },
      { $group: { _id: '$conversationHistory.query', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).exec();

    // Recent activity (from customers by lastInteraction)
    const recentActivityPromise = this.customerModel
      .find({ businessId: bid })
      .sort({ lastInteraction: -1 })
      .limit(10)
      .select('name lastInteraction')
      .lean()
      .exec();

    const [totalCustomers, ticketAgg, upcomingMeetings, conversationsAgg, commonQueries, recentCustomers] =
      await Promise.all([
        totalCustomersPromise,
        ticketAggPromise,
        upcomingMeetingsPromise,
        conversationsAggPromise,
        commonQueriesPromise,
        recentActivityPromise,
      ]);

    // Map ticket aggregation into status counts
    const statusMap: Record<string, number> = { open: 0, 'in-progress': 0, resolved: 0, closed: 0 };
    for (const t of ticketAgg) {
      statusMap[t._id] = t.count;
    }

    const openTickets = (statusMap['open'] || 0) + (statusMap['in-progress'] || 0);
    const inProgressTickets = statusMap['in-progress'] || 0;
    const resolvedTickets = statusMap['resolved'] || 0;

    const totalHandled = resolvedTickets + openTickets + inProgressTickets + (statusMap['closed'] || 0);
    const resolutionRate = totalHandled > 0 ? Math.round((resolvedTickets / totalHandled) * 100) : 0;

    const conversations = (conversationsAgg && conversationsAgg.length ? conversationsAgg[0].conversations : 0) || 0;

    const topQueries = (commonQueries || []).map((q) => ({ query: q._id, count: q.count }));

    const recentActivity = (recentCustomers || []).map((c) => ({ customer: c.name, action: 'Interacted', time: c.lastInteraction }));

    return {
      totalCustomers,
      conversations,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      resolutionRate,
      upcomingMeetings,
      commonQueries: topQueries,
      recentActivity,
    };
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



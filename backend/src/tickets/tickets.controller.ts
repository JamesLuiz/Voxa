import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Ticket, TicketDocument } from '../schemas/ticket.schema';

@Controller('api/tickets')
export class TicketsController {
  constructor(@InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>) {}

  @Post()
  async create(@Body() body: any) {
    const created = await this.ticketModel.create({
      businessId: new Types.ObjectId(body.businessId),
      customerId: new Types.ObjectId(body.customerId),
      title: body.title,
      description: body.description,
      priority: body.priority || 'low',
      status: 'open',
      internalNotes: [],
    });
    return created;
  }

  @Get()
  async list(@Query('businessId') businessId?: string, @Query('status') status?: string) {
    const filter: any = {};
    if (businessId) filter.businessId = new Types.ObjectId(businessId);
    if (status) filter.status = status;
    return this.ticketModel.find(filter).lean();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.ticketModel.findById(new Types.ObjectId(id)).lean();
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'open' | 'in-progress' | 'resolved' | 'closed' },
  ) {
    const update: any = { status: body.status };
    if (body.status === 'resolved' || body.status === 'closed') update.resolvedAt = new Date();
    return this.ticketModel.findByIdAndUpdate(new Types.ObjectId(id), { $set: update }, { new: true });
  }

  @Put(':id/assign')
  async assign(@Param('id') id: string, @Body() body: { assignedTo: string }) {
    return this.ticketModel.findByIdAndUpdate(
      new Types.ObjectId(id),
      { $set: { assignedTo: body.assignedTo } },
      { new: true },
    );
  }

  @Post(':id/notes')
  async addNote(@Param('id') id: string, @Body() body: { note: string }) {
    return this.ticketModel.findByIdAndUpdate(
      new Types.ObjectId(id),
      { $push: { internalNotes: body.note } },
      { new: true },
    );
  }
}



import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Ticket, TicketDocument } from '../schemas/ticket.schema';
import { Business, BusinessDocument } from '../schemas/business.schema';
import { Customer, CustomerDocument } from '../schemas/customer.schema';

@Controller('api/tickets')
export class TicketsController {
  constructor(
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(Business.name) private businessModel: Model<BusinessDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
  ) {}

  // Create a ticket. Accepts either businessId or businessSlug, and either customerId or customerEmail.
  // If only customerEmail is provided, the controller will try to find or create the customer (upsert by email).
  @Post()
  async create(@Body() body: any) {
    // Resolve business: prefer businessId, else businessSlug
    let businessId: Types.ObjectId | null = null;
    if (body.businessId) {
      try {
        businessId = new Types.ObjectId(body.businessId);
      } catch {
        businessId = null;
      }
    }
    if (!businessId && body.businessSlug) {
      const slug = String(body.businessSlug).trim().toLowerCase();
      const biz = await this.businessModel.findOne({ slug }).lean();
      if (biz && biz._id) businessId = new Types.ObjectId(String((biz as any)._id));
    }
    if (!businessId) throw new Error('Missing or invalid business identifier (businessId or businessSlug required)');

    // Determine if caller is owner by email
    const callerEmail = body.userEmail || body.email || '';
    const business = await this.businessModel.findById(businessId).lean();

    let isOwner = false;
    let ownerName = '';
    if (business && business.owner && callerEmail) {
      if (String(business.owner.email).toLowerCase() === String(callerEmail).toLowerCase()) {
        isOwner = true;
        ownerName = business.owner.name || '';
      }
    }

    // Resolve or create customer. If the caller is the owner and they want owner-level behavior, we don't require a customer.
    let customerId: Types.ObjectId | null = null;
    if (body.customerId) {
      try {
        customerId = new Types.ObjectId(body.customerId);
      } catch {
        customerId = null;
      }
    }

    if (!customerId && body.customerEmail) {
      // Attempt to find an existing customer for this business by email
      const email = String(body.customerEmail).trim().toLowerCase();
      let customer = await this.customerModel.findOne({ businessId, email }).exec();
      if (!customer) {
        // upsert: create minimal customer record if name or email available
        const name = body.customerName || email.split('@')[0];
        customer = await this.customerModel.create({
          businessId,
          name,
          email,
          phone: body.customerPhone,
          company: body.customerCompany,
          tags: [],
          conversationHistory: [],
          lastInteraction: new Date(),
        });
      }
  if (customer && customer._id) customerId = new Types.ObjectId(String((customer as any)._id));
    }

    // If still no customerId and caller is not owner, fail
    if (!customerId && !isOwner) {
      throw new Error('Missing required: customerId or customerEmail for non-owner requests');
    }

    // Compose ticket document
    const ticketDoc: any = {
      businessId,
      title: body.title || (isOwner ? `Owner created ticket` : `Support request`),
      description: body.description || '',
      priority: body.priority || 'low',
      status: 'open',
      internalNotes: [],
      createdByOwner: !!isOwner,
    };
    if (customerId) ticketDoc.customerId = customerId;
    if (isOwner) ticketDoc.ownerName = ownerName;

    const created = await this.ticketModel.create(ticketDoc);

    // Return a richer response to owners
    if (isOwner) {
      return {
        ticket: created,
        owner: { name: ownerName, email: business.owner.email },
        business: { businessId: String(business._id), name: business.name },
      };
    }

    return created;
  }

  @Get()
  async list(@Query('businessId') businessId?: string, @Query('status') status?: string) {
    const filter: any = {};
    if (businessId) filter.businessId = new Types.ObjectId(businessId);
    if (status) filter.status = status;
    return this.ticketModel.find(filter).lean();
  }

  // Latest ticket for a given business and customer email
  @Get('latest')
  async latest(
    @Query('businessId') businessId?: string,
    @Query('customerEmail') customerEmail?: string,
  ) {
    if (!businessId || !customerEmail) return {};
    let _biz: Types.ObjectId | null = null;
    try { _biz = new Types.ObjectId(businessId); } catch { _biz = null; }
    if (!_biz) return {};

    const customer = await this.customerModel.findOne({ businessId: _biz, email: String(customerEmail).trim().toLowerCase() }).lean();
    if (!customer || !customer._id) return {};

    const ticket = await this.ticketModel
      .findOne({ businessId: _biz, customerId: new Types.ObjectId(String(customer._id)) })
      .sort({ createdAt: -1 })
      .lean();
    return ticket || {};
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



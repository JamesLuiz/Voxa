import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CreateTicketDto, UpdateTicketStatusDto, AssignTicketDto, AddNoteDto } from '../dto/tickets.dto';
import { ApiTags } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Ticket, TicketDocument } from '../schemas/ticket.schema';
import { Business, BusinessDocument } from '../schemas/business.schema';
import { Customer, CustomerDocument } from '../schemas/customer.schema';

@ApiTags('Tickets')
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
  async create(@Body() body: CreateTicketDto) {
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
  const callerEmail = body.userEmail || '';
  const business = await this.businessModel.findById(businessId).lean();

    let isOwner = false;
    let ownerName = '';
    if (business && business.owner && callerEmail) {
      if (String(business.owner.email).toLowerCase() === String(callerEmail).toLowerCase()) {
        isOwner = true;
        ownerName = business.owner.name || '';
      }
    }

    // Resolve or create customer using provided userEmail (customer's email) and optional customerName/phone.
    // If the caller is the owner and they want owner-level behavior, we don't require a customer.
    let customerId: Types.ObjectId | null = null;
    if (callerEmail) {
      const email = String(callerEmail).trim().toLowerCase();
      let customer = await this.customerModel.findOne({ businessId, email }).exec();
      if (!customer) {
        const name = body.customerName || email.split('@')[0];
        customer = await this.customerModel.create({
          businessId,
          name,
          email,
          phone: body.customerPhone,
          tags: [],
          conversationHistory: [],
          lastInteraction: new Date(),
        });
      }
      if (customer && customer._id) customerId = new Types.ObjectId(String((customer as any)._id));
    }

    // If still no customerId and caller is not owner, fail
    if (!customerId && !isOwner) {
      throw new Error('Missing required: userEmail (customer email) for non-owner requests');
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

    // Build base response
    const baseResponse: any = { ticket: created };

    // Include business context when available (especially when caller provided businessSlug)
    if (business) {
      baseResponse.business = {
        businessId: String(business._id),
        name: business.name,
        slug: business.slug,
        description: business.description,
        products: business.products || [],
        owner: business.owner ? { name: business.owner.name, email: business.owner.email } : undefined,
      };
    }

    // Owner callers get additional owner info
    if (isOwner) {
      baseResponse.owner = { name: ownerName, email: business?.owner?.email };
    }

    // If caller was a non-owner and we did not create an owner-style response, return the created ticket directly
    if (!isOwner && !baseResponse.business) return created;
    return baseResponse;
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
    @Body() body: UpdateTicketStatusDto,
  ) {
    const update: any = { status: body.status };
    if (body.status === 'resolved' || body.status === 'closed') update.resolvedAt = new Date();
    return this.ticketModel.findByIdAndUpdate(new Types.ObjectId(id), { $set: update }, { new: true });
  }

  @Put(':id/assign')
  async assign(@Param('id') id: string, @Body() body: AssignTicketDto) {
    return this.ticketModel.findByIdAndUpdate(
      new Types.ObjectId(id),
      { $set: { assignedTo: body.assignedTo } },
      { new: true },
    );
  }

  @Post(':id/notes')
  async addNote(@Param('id') id: string, @Body() body: AddNoteDto) {
    return this.ticketModel.findByIdAndUpdate(
      new Types.ObjectId(id),
      { $push: { internalNotes: body.note } },
      { new: true },
    );
  }
}



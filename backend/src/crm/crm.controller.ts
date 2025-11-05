import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CreateCustomerDto, UpsertCustomerDto } from '../dto/crm.dto';
import { ApiTags } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Customer, CustomerDocument } from '../schemas/customer.schema';

@ApiTags('CRM')
@Controller('api/crm/customers')
export class CrmController {
  constructor(@InjectModel(Customer.name) private customerModel: Model<CustomerDocument>) {}

  @Post()
  async create(@Body() body: CreateCustomerDto) {
    const created = await this.customerModel.create({
      businessId: new Types.ObjectId(body.businessId),
      name: body.name,
      email: body.email,
      phone: body.phone,
      company: body.company,
      tags: body.tags || [],
      conversationHistory: [],
      lastInteraction: new Date(),
    });
    return created;
  }

  @Post('upsert')
  async upsert(@Body() body: UpsertCustomerDto) {
    if (!body.businessId || !body.email || !body.name) throw new Error('Missing required businessId, email, or name');
    const filter: any = { businessId: new Types.ObjectId(body.businessId), email: body.email };
    let customer = await this.customerModel.findOne(filter);
    if (!customer) {
      customer = await this.customerModel.create({
        businessId: new Types.ObjectId(body.businessId),
        name: body.name,
        email: body.email,
        phone: body.phone,
        company: body.company,
        tags: [],
        conversationHistory: [],
        lastInteraction: new Date(),
      });
    }
    return customer;
  }

  // Append a conversation entry by customer id
  @Post(':id/conversations')
  async appendConversationById(
    @Param('id') id: string,
    @Body() body: { role: 'user' | 'assistant'; content: string; timestamp?: string | Date },
  ) {
    const conv = {
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
      query: body.role === 'user' ? body.content : '',
      response: body.role === 'assistant' ? body.content : '',
    } as any;

    const updated = await this.customerModel.findByIdAndUpdate(
      new Types.ObjectId(id),
      { $push: { conversationHistory: conv }, $set: { lastInteraction: new Date() } },
      { new: true }
    );
    return updated;
  }

  // Append a conversation entry by email (+ optional businessId)
  @Post('email/:email/conversations')
  async appendConversationByEmail(
    @Param('email') email: string,
    @Body() body: { role: 'user' | 'assistant'; content: string; timestamp?: string | Date },
    @Query('businessId') businessId?: string,
  ) {
    const filter: any = { email: String(email).trim().toLowerCase() };
    if (businessId) filter.businessId = new Types.ObjectId(businessId);
    const customer = await this.customerModel.findOne(filter);
    if (!customer) return {};

    const conv = {
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
      query: body.role === 'user' ? body.content : '',
      response: body.role === 'assistant' ? body.content : '',
    } as any;

    const updated = await this.customerModel.findByIdAndUpdate(
      customer._id,
      { $push: { conversationHistory: conv }, $set: { lastInteraction: new Date() } },
      { new: true }
    );
    return updated;
  }

  @Get()
  async list(@Query('businessId') businessId: string) {
    const filter: any = {};
    if (businessId) filter.businessId = new Types.ObjectId(businessId);
    return this.customerModel.find(filter).lean();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.customerModel.findById(new Types.ObjectId(id)).lean();
  }

  @Get('email/:email')
  async getByEmail(@Param('email') email: string, @Query('businessId') businessId?: string) {
    const filter: any = { email };
    if (businessId) filter.businessId = new Types.ObjectId(businessId);
    return this.customerModel.findOne(filter).lean();
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    const updated = await this.customerModel.findByIdAndUpdate(new Types.ObjectId(id), { $set: body }, { new: true });
    return updated;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.customerModel.findByIdAndDelete(new Types.ObjectId(id));
    return { ok: true };
  }

  @Get('search')
  async search(@Query('q') q: string, @Query('businessId') businessId?: string) {
    const filter: any = {};
    if (businessId) filter.businessId = new Types.ObjectId(businessId);
    if (q) filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
      { company: { $regex: q, $options: 'i' } },
      { tags: { $in: [new RegExp(q, 'i')] } },
    ];
    return this.customerModel.find(filter).lean();
  }
}



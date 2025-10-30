import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Customer, CustomerDocument } from '../schemas/customer.schema';

@Controller('api/crm/customers')
export class CrmController {
  constructor(@InjectModel(Customer.name) private customerModel: Model<CustomerDocument>) {}

  @Post()
  async create(@Body() body: any) {
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
  async upsert(@Body() body: {businessId: string, name: string, email: string, phone?: string, company?: string}) {
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



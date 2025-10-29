import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Business, BusinessDocument } from '../schemas/business.schema';

@Controller('api/business')
export class BusinessController {
  constructor(@InjectModel(Business.name) private businessModel: Model<BusinessDocument>) {}

  @Get('context/:businessId')
  async getContext(@Param('businessId') businessId: string) {
    const _id = new Types.ObjectId(businessId);
    const biz = await this.businessModel.findById(_id).lean();
    if (!biz) return {};
    return {
      name: biz.name,
      description: biz.description,
      products: biz.products || [],
      policies: biz.policies || '',
      agentConfig: biz.agentConfig || {},
    };
  }

  @Put(':id')
  async updateBusiness(
    @Param('id') id: string,
    @Body() body: { description?: string; products?: string[]; policies?: string },
  ) {
    const _id = new Types.ObjectId(id);
    const update: any = {};
    if (typeof body.description === 'string') update.description = body.description;
    if (Array.isArray(body.products)) update.products = body.products;
    if (typeof body.policies === 'string') update.policies = body.policies;
    const updated = await this.businessModel.findByIdAndUpdate(_id, { $set: update }, { new: true }).lean();
    return { ok: true, businessId: id, updated: !!updated };
  }
}



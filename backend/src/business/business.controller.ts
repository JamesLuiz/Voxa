import { Body, Controller, Get, Param, Put, Req } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Business, BusinessDocument } from '../schemas/business.schema';

@Controller('api/business')
export class BusinessController {
  constructor(@InjectModel(Business.name) private businessModel: Model<BusinessDocument>) {}

  @Get('by-slug/:slug')
  async getBySlug(@Param('slug') slug: string) {
    const norm = String(slug).trim().toLowerCase();
    // Prefer exact slug match; fallback to case-insensitive name for legacy data
    let biz = await this.businessModel.findOne({ slug: norm }).lean();
    if (!biz) {
      biz = await this.businessModel.findOne({ name: { $regex: new RegExp(`^${norm}$`, 'i') } }).lean();
    }
    if (!biz) return {};
    return { businessId: String(biz._id), name: biz.name };
  }

  @Get('resolve')
  async resolveBusiness(@Req() req: any) {
    // Priority: token (future) -> host (future) -> default env -> first business
    const defaultId = process.env.DEFAULT_BUSINESS_ID;
    let biz: any = null;
    if (defaultId) {
      try {
        const _id = new Types.ObjectId(defaultId);
        biz = await this.businessModel.findById(_id).lean();
      } catch {
        // ignore
      }
    }
    if (!biz) {
      biz = await this.businessModel.findOne().lean();
    }
    if (!biz) return {};
    return { businessId: String(biz._id), name: biz.name };
  }

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



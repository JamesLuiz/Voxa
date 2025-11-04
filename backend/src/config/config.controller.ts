import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { AgentConfigDto } from '../dto/business.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Business, BusinessDocument } from '../schemas/business.schema';

@Controller('api/config')
export class ConfigController {
  constructor(@InjectModel(Business.name) private businessModel: Model<BusinessDocument>) {}

  @Get('agent/:businessId')
  async getAgentConfig(@Param('businessId') businessId: string) {
    const _id = new Types.ObjectId(businessId);
    const biz = await this.businessModel.findById(_id).lean();
    return biz?.agentConfig || {};
  }

  @Put('agent/:businessId')
  async updateAgentConfig(
    @Param('businessId') businessId: string,
    @Body() body: AgentConfigDto,
  ) {
    const _id = new Types.ObjectId(businessId);
    const updated = await this.businessModel.findByIdAndUpdate(
      _id,
      { $set: Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined)) },
      { new: true },
    );
    return { ok: true, agentConfig: updated?.agentConfig };
  }
}



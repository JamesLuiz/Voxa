import { Body, Controller, Param, Post, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GeneralUser, GeneralUserDocument } from '../schemas/general-user.schema';

@Controller('api/general/users')
export class GeneralConversationController {
  constructor(@InjectModel(GeneralUser.name) private generalModel: Model<GeneralUserDocument>) {}

  @Post(':id/conversations')
  async appendById(
    @Param('id') id: string,
    @Body() body: { role: 'user' | 'assistant'; content: string; timestamp?: string | Date },
  ) {
    const entry = {
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
      role: body.role,
      content: body.content,
    } as any;
    const updated = await this.generalModel.findByIdAndUpdate(
      new Types.ObjectId(id),
      { $push: { conversationHistory: entry }, $set: { lastInteraction: new Date() } },
      { new: true }
    );
    return updated || {};
  }

  @Post('email/:email/conversations')
  async appendByEmail(
    @Param('email') email: string,
    @Body() body: { role: 'user' | 'assistant'; content: string; timestamp?: string | Date },
  ) {
    const user = await this.generalModel.findOne({ email: String(email).trim().toLowerCase() });
    if (!user) return {};
    const entry = {
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
      role: body.role,
      content: body.content,
    } as any;
    const updated = await this.generalModel.findByIdAndUpdate(
      user._id,
      { $push: { conversationHistory: entry }, $set: { lastInteraction: new Date() } },
      { new: true }
    );
    return updated || {};
  }
}



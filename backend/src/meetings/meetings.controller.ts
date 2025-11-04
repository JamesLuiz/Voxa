import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CreateMeetingDto } from '../dto/meetings.dto';
import { ApiTags } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Meeting, MeetingDocument } from '../schemas/meeting.schema';

@ApiTags('Meetings')
@Controller('api/meetings')
export class MeetingsController {
  constructor(@InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>) {}

  @Post()
  async create(@Body() body: CreateMeetingDto) {
    const created = await this.meetingModel.create({
      businessId: new Types.ObjectId(body.businessId),
      customerId: new Types.ObjectId(body.customerId),
      title: body.title,
      startTime: new Date(body.startTime),
      duration: Number(body.duration) || 30,
      attendees: body.attendees || [],
      status: 'scheduled',
      notes: body.notes,
    });
    return created;
  }

  @Get()
  async list(@Query('businessId') businessId?: string) {
    const filter: any = {};
    if (businessId) filter.businessId = new Types.ObjectId(businessId);
    return this.meetingModel.find(filter).lean();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.meetingModel.findById(new Types.ObjectId(id)).lean();
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.meetingModel.findByIdAndUpdate(new Types.ObjectId(id), { $set: body }, { new: true });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.meetingModel.findByIdAndDelete(new Types.ObjectId(id));
    return { ok: true };
  }
}



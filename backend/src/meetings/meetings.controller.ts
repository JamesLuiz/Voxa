import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CreateMeetingDto } from '../dto/meetings.dto';
import { ApiTags } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Meeting, MeetingDocument } from '../schemas/meeting.schema';
import { Customer, CustomerDocument } from '../schemas/customer.schema';

@ApiTags('Meetings')
@Controller('api/meetings')
export class MeetingsController {
  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>
  ) {}

  @Post()
  async create(@Body() body: CreateMeetingDto) {
    const meetingData: any = {
      businessId: new Types.ObjectId(body.businessId),
      title: body.title,
      startTime: new Date(body.startTime),
      duration: Number(body.duration) || 30,
      attendees: body.attendees || [],
      status: 'scheduled',
    };
    
    // Only add customerId if provided (for owner-initiated meetings, it may be optional)
    if (body.customerId) {
      try {
        meetingData.customerId = new Types.ObjectId(body.customerId);
      } catch (e) {
        // If customerId is not a valid ObjectId, skip it (might be a placeholder)
        // Owner-initiated meetings don't require a customer
      }
    }
    
    if (body.notes) {
      meetingData.notes = body.notes;
    }
    
    const created = await this.meetingModel.create(meetingData);
    return created;
  }

  @Get()
  async list(@Query('businessId') businessId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    const filter: any = {};
    if (businessId) filter.businessId = new Types.ObjectId(businessId);
    if (from) filter.startTime = { $gte: new Date(from) };
    if (to) {
      filter.startTime = filter.startTime || {};
      filter.startTime.$lte = new Date(to);
    }
    const meetings = await this.meetingModel.find(filter).lean().sort({ startTime: 1 });
    
    // Populate customer info if customerId exists
    const meetingsWithCustomerInfo = await Promise.all(
      meetings.map(async (m: any) => {
        let customerName = null;
        let customerEmail = null;
        
        // Try to get customer name if customerId exists
        if (m.customerId) {
          try {
            const customer = await this.customerModel.findById(m.customerId).lean();
            if (customer) {
              customerName = customer.name;
              customerEmail = customer.email;
            }
          } catch (e) {
            // Customer not found or invalid ID
          }
        }
        
        // Determine "with" field: prefer attendees, then customer name, then customer email, then customerId
        let withField = "N/A";
        if (m.attendees && m.attendees.length > 0) {
          withField = m.attendees.join(", ");
        } else if (customerName) {
          withField = customerName;
        } else if (customerEmail) {
          withField = customerEmail;
        } else if (m.customerId) {
          withField = String(m.customerId);
        }
        
        return {
          ...m,
          id: m._id || m.id,
          startsAt: m.startTime, // Also include startsAt for frontend compatibility
          with: withField,
          customerName: customerName || undefined,
          customerEmail: customerEmail || undefined,
        };
      })
    );
    
    return meetingsWithCustomerInfo;
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



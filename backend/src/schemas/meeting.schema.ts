import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MeetingDocument = Meeting & Document;

@Schema({ collection: 'meetings', timestamps: { createdAt: true, updatedAt: true } })
export class Meeting {
  @Prop({ type: Types.ObjectId, ref: 'Business', index: true, required: true })
  businessId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Customer', index: true, required: false })
  customerId?: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  startTime: Date;

  @Prop({ required: true })
  duration: number; // minutes

  @Prop({ type: [String], default: [] })
  attendees: string[];

  @Prop({ enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' })
  status: 'scheduled' | 'completed' | 'cancelled';

  @Prop()
  notes?: string;
}

export const MeetingSchema = SchemaFactory.createForClass(Meeting);



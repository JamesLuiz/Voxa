import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TicketDocument = Ticket & Document;

@Schema({ collection: 'tickets', timestamps: { createdAt: true, updatedAt: true } })
export class Ticket {
  @Prop({ type: Types.ObjectId, ref: 'Business', index: true, required: true })
  businessId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Customer', index: true, required: true })
  customerId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ enum: ['low', 'medium', 'high', 'urgent'], default: 'low' })
  priority: 'low' | 'medium' | 'high' | 'urgent';

  @Prop({ enum: ['open', 'in-progress', 'resolved', 'closed'], default: 'open' })
  status: 'open' | 'in-progress' | 'resolved' | 'closed';

  @Prop()
  assignedTo?: string;

  @Prop({ type: [String], default: [] })
  internalNotes: string[];

  @Prop()
  resolvedAt?: Date;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);



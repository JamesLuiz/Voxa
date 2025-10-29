import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CustomerDocument = Customer & Document;

@Schema({ _id: false })
export class ConversationEntry {
  @Prop({ required: true })
  timestamp: Date;

  @Prop({ required: true })
  query: string;

  @Prop({ required: true })
  response: string;
}

const ConversationEntrySchema = SchemaFactory.createForClass(ConversationEntry);

@Schema({ collection: 'customers', timestamps: { createdAt: true, updatedAt: true } })
export class Customer {
  @Prop({ type: Types.ObjectId, ref: 'Business', index: true, required: true })
  businessId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, index: true })
  email: string;

  @Prop()
  phone?: string;

  @Prop()
  company?: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [ConversationEntrySchema], default: [] })
  conversationHistory: ConversationEntry[];

  @Prop({ default: Date.now })
  lastInteraction: Date;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);



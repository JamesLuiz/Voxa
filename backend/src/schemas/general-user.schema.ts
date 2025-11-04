import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GeneralUserDocument = GeneralUser & Document;

@Schema({ _id: false })
export class GeneralConversationEntry {
  @Prop({ required: true })
  timestamp: Date;

  @Prop({ required: true })
  role: 'user' | 'assistant';

  @Prop({ required: true })
  content: string;
}

const GeneralConversationEntrySchema = SchemaFactory.createForClass(GeneralConversationEntry);

@Schema({ collection: 'general_users', timestamps: { createdAt: true, updatedAt: true } })
export class GeneralUser {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, index: true })
  email: string;

  @Prop({ required: true })
  location: string;

  @Prop({ type: [GeneralConversationEntrySchema], default: [] })
  conversationHistory: GeneralConversationEntry[];

  @Prop({ default: Date.now })
  lastInteraction: Date;
}

export const GeneralUserSchema = SchemaFactory.createForClass(GeneralUser);



import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BusinessDocument = Business & Document;

@Schema({ _id: true, timestamps: { createdAt: true, updatedAt: true } })
export class BusinessOwner {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;
}

export const BusinessOwnerSchema = SchemaFactory.createForClass(BusinessOwner);

@Schema({ _id: true, timestamps: { createdAt: true, updatedAt: true } })
export class AgentConfig {
  @Prop({ enum: ['professional', 'casual', 'friendly'], default: 'professional' })
  tone: 'professional' | 'casual' | 'friendly';

  @Prop({ enum: ['concise', 'detailed'], default: 'concise' })
  responseStyle: 'concise' | 'detailed';

  @Prop({ type: Object, default: {} })
  businessHours: Record<string, string>;

  @Prop({ default: false })
  autoEscalate: boolean;

  @Prop({ default: '' })
  customPrompt: string;
}

export const AgentConfigSchema = SchemaFactory.createForClass(AgentConfig);

@Schema({ collection: 'businesses', timestamps: { createdAt: true, updatedAt: true } })
export class Business {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop({ required: true })
  industry: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ type: [String], default: [] })
  products: string[];

  @Prop({ default: '' })
  policies: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  email: string;

  @Prop()
  website?: string;

  @Prop({ type: BusinessOwnerSchema, required: true })
  owner: BusinessOwner;

  @Prop({ type: AgentConfigSchema, default: {} })
  agentConfig: AgentConfig;
}

export const BusinessSchema = SchemaFactory.createForClass(Business);



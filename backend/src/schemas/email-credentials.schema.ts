import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EmailCredentialsDocument = EmailCredentials & Document;

@Schema({ collection: 'email_credentials', timestamps: { createdAt: true, updatedAt: true } })
export class EmailCredentials {
  @Prop({ required: true, index: true })
  businessId: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  // For new installs we store the encrypted password. Older installs may still have passwordHash.
  passwordHash?: string;

  @Prop({ required: false })
  encryptedPassword?: string;

  @Prop({ default: 'smtp.gmail.com' })
  smtpServer: string;

  @Prop({ default: 587 })
  smtpPort: number;
}

export const EmailCredentialsSchema = SchemaFactory.createForClass(EmailCredentials);
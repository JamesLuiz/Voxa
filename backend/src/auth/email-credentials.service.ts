import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmailCredentials, EmailCredentialsDocument } from '../schemas/email-credentials.schema';
import { encryptText, decryptText } from '../utils/crypto.util';
import sgMail from '@sendgrid/mail';

@Injectable()
export class EmailCredentialsService {
  constructor(
    @InjectModel(EmailCredentials.name)
    private emailCredentialsModel: Model<EmailCredentialsDocument>,
  ) {}


  async saveCredentials(businessId: string, email: string, apiKey: string): Promise<EmailCredentials> {
    const key = process.env.EMAIL_ENCRYPTION_KEY || '';
    if (!key) {
      throw new Error('EMAIL_ENCRYPTION_KEY is not set on the server');
    }

    const encryptedApiKey = encryptText(apiKey, key);

    const existingCredentials = await this.emailCredentialsModel.findOne({ businessId }).exec();
    if (existingCredentials) {
      existingCredentials.email = email;
      existingCredentials.sendgridApiKey = encryptedApiKey;
      // Clear legacy password fields to avoid confusion
      existingCredentials.encryptedPassword = undefined;
      existingCredentials.passwordHash = undefined;
      return existingCredentials.save();
    }

    const newCredentials = new this.emailCredentialsModel({ businessId, email, sendgridApiKey: encryptedApiKey });
    return newCredentials.save();
  }

  async verifySendGrid(email: string, apiKey: string): Promise<{ ok: boolean; message?: string }> {
    try {
      sgMail.setApiKey(apiKey);

      // Send test email to verify key. Note SendGrid may require sender verification for the 'from' address.
      await sgMail.send({
        to: email,
        from: email,
        subject: 'SendGrid Verification Test',
        text: 'If you receive this, your SendGrid API key is working!',
        html: '<p>If you receive this, your SendGrid API key is <strong>working!</strong></p>',
      });

      return { ok: true };
    } catch (err: any) {
      console.error('SendGrid verification error:', err?.response?.body || err?.message || err);

      let message = 'Verification failed';
      if (err?.code === 401 || err?.code === 403) {
        message = 'Invalid API key. Please check your SendGrid API key.';
      } else if (err?.response?.body?.errors?.[0]?.message) {
        message = err.response.body.errors[0].message;
      } else {
        message = err?.message || 'Unknown error occurred';
      }

      return { ok: false, message };
    }
  }

  async getCredentials(businessId: string): Promise<EmailCredentials> {
    return this.emailCredentialsModel.findOne({ businessId }).exec();
  }

  async getDecryptedCredentials(businessId: string): Promise<{ email: string; apiKey: string } | null> {
    const credentials = await this.emailCredentialsModel.findOne({ businessId }).exec();
    if (!credentials) return null;

    const key = process.env.EMAIL_ENCRYPTION_KEY || '';
    if (!key) throw new Error('EMAIL_ENCRYPTION_KEY is not configured on the server');

    if (credentials.sendgridApiKey) {
      return { email: credentials.email, apiKey: decryptText(credentials.sendgridApiKey, key) };
    }

    // Fallback: if encryptedPassword exists (legacy SMTP usage), return it as password
    if (credentials.encryptedPassword) {
      return { email: credentials.email, apiKey: decryptText(credentials.encryptedPassword, key) };
    }

    return null;
  }
}
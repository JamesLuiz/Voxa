import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmailCredentials, EmailCredentialsDocument } from '../schemas/email-credentials.schema';
import { encryptText, decryptText } from '../utils/crypto.util';
import nodemailer from 'nodemailer';

@Injectable()
export class EmailCredentialsService {
  constructor(
    @InjectModel(EmailCredentials.name)
    private emailCredentialsModel: Model<EmailCredentialsDocument>,
  ) {}

  async saveCredentials(businessId: string, email: string, password: string): Promise<EmailCredentials> {
    // Encrypt the password for storage (we need the plaintext later to send emails)
    const key = process.env.EMAIL_ENCRYPTION_KEY || '';
    if (!key) {
      throw new Error('EMAIL_ENCRYPTION_KEY is not set on the server');
    }
    const encryptedPassword = encryptText(password, key);

    // Check if credentials already exist for this business
    const existingCredentials = await this.emailCredentialsModel.findOne({ businessId }).exec();
    
    if (existingCredentials) {
      // Update existing credentials
      existingCredentials.email = email;
      existingCredentials.encryptedPassword = encryptedPassword;
      existingCredentials.passwordHash = undefined;
      return existingCredentials.save();
    } else {
      // Create new credentials
      const newCredentials = new this.emailCredentialsModel({
        businessId,
        email,
        encryptedPassword,
      });
      return newCredentials.save();
    }
  }

  async verifySmtp(email: string, password: string, smtpServer = 'smtp.gmail.com', smtpPort = 587): Promise<{ ok: boolean; message?: string }> {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpServer,
        port: Number(smtpPort),
        secure: Number(smtpPort) === 465, // true for 465, false for other ports
        auth: {
          user: email,
          pass: password,
        },
      });

      // nodemailer verify will attempt to connect and authenticate
      await transporter.verify();
      return { ok: true };
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err);
      return { ok: false, message: msg };
    }
  }

  async getCredentials(businessId: string): Promise<EmailCredentials> {
    return this.emailCredentialsModel.findOne({ businessId }).exec();
  }

  async getDecryptedCredentials(businessId: string): Promise<{ email: string; password: string }> {
    const credentials = await this.emailCredentialsModel.findOne({ businessId }).exec();
    
    if (!credentials) {
      return null;
    }

    const key = process.env.EMAIL_ENCRYPTION_KEY || '';
    if (!key) {
      throw new Error('EMAIL_ENCRYPTION_KEY is not configured on the server');
    }

    // Prefer encryptedPassword; if only legacy passwordHash exists we can't decrypt it and must fail
    if (credentials.encryptedPassword) {
      const decrypted = decryptText(credentials.encryptedPassword, key);
      return { email: credentials.email, password: decrypted };
    }

    // If we only have a legacy passwordHash, return null to indicate migration is required
    return null;
  }
}
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
      // Special handling for Gmail which may require app password
      const isGmail = email.endsWith('@gmail.com') || smtpServer.includes('gmail');
      
      const transportConfig: any = {
        port: Number(smtpPort),
        secure: Number(smtpPort) === 465, // true for 465, false for other ports
        auth: {
          user: email,
          pass: password,
        },
        // Add debug option to help troubleshoot connection issues
        debug: process.env.NODE_ENV !== 'production',
        // Increase timeout for slow connections
        connectionTimeout: 10000, // 10 seconds
        // Disable TLS verification in development for testing
        ...(process.env.NODE_ENV !== 'production' && {
          tls: {
            rejectUnauthorized: false
          }
        })
      };

      // For Gmail, prefer using the named service so nodemailer applies provider defaults.
      // Avoid setting host when using `service: 'gmail'` to prevent conflicts.
      if (isGmail) {
        transportConfig.service = 'gmail';
      } else {
        transportConfig.host = smtpServer;
      }

      // Create transporter and log non-sensitive transport properties to help debug
      const transporter = nodemailer.createTransport(transportConfig);
      const maskedConfig = {
        host: transportConfig.host,
        port: transportConfig.port,
        secure: transportConfig.secure,
        service: transportConfig.service,
        authUser: transportConfig.auth?.user,
      };
      console.info('SMTP verify - transport config (masked):', maskedConfig);

      // nodemailer verify will attempt to connect and authenticate
      await transporter.verify();
      return { ok: true };
    } catch (err: unknown) {
      // Log detailed error info (avoid logging secrets)
      const anyErr = err as any;
      console.error('SMTP Verification Error:', {
        message: anyErr?.message,
        code: anyErr?.code,
        response: anyErr?.response,
        responseCode: anyErr?.responseCode,
        command: anyErr?.command,
        stack: anyErr instanceof Error ? anyErr.stack : undefined,
      });

      // Parse common authentication error cases and return helpful hints
      let msg = (anyErr && typeof anyErr === 'object' && 'message' in anyErr) ? String(anyErr.message) : String(err);
      // Nodemailer/SMTP common auth error codes: EAUTH, 535, 5.7.8
      if (anyErr?.code === 'EAUTH' || /535|5\.7\.8|Authentication failed|Invalid credentials/i.test(String(anyErr?.response || anyErr?.message))) {
        msg = 'Authentication failed: invalid credentials or blocked login. For Gmail accounts use an App Password when 2FA is enabled, or configure OAuth2. Also check for provider "less secure app"/security alerts.';
      } else if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(msg)) {
        msg = 'Connection failed to SMTP server. Check host, port and network connectivity.';
      }

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
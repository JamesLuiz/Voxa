import { Body, Controller, Get, Post, Param, Req, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { EmailCredentialsService } from './email-credentials.service';

// Simple in-memory rate limiter for verification endpoint to reduce abuse.
// Keyed by IP address. This is intentionally lightweight; for production use a shared store (redis) or Nest throttler.
const _verifyAttempts: Map<string, { count: number; first: number }> = new Map();
const VERIFY_WINDOW_MS = 60 * 1000; // 1 minute
const VERIFY_MAX = 10; // max attempts per window per IP

@Controller('api/email-credentials')
export class EmailCredentialsController {
  constructor(private readonly emailCredentialsService: EmailCredentialsService) {}

  @Post()
  async saveCredentials(
    @Body() body: { businessId: string; email: string; password: string; smtpServer?: string; smtpPort?: number },
    @Req() req: Request,
  ) {
    // Rate limit by IP
    const ip = (req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown') as string;
    const key = `verify:${ip}`;
    const now = Date.now();
    const entry = _verifyAttempts.get(key) || { count: 0, first: now };
    if (now - entry.first > VERIFY_WINDOW_MS) {
      entry.count = 0;
      entry.first = now;
    }
    entry.count += 1;
    _verifyAttempts.set(key, entry);
    if (entry.count > VERIFY_MAX) {
      return { success: false, verified: false, message: 'Too many verification attempts, please try again later' };
    }
    const { businessId, email, password, smtpServer, smtpPort } = body;

    // Use Gmail defaults if not provided
    const server = smtpServer || 'smtp.gmail.com';
    const port = smtpPort || 587;

    // Verify SMTP credentials before saving
    const verify = await this.emailCredentialsService.verifySmtp(email, password, server, port);
    if (!verify.ok) {
      return { success: false, verified: false, message: verify.message || 'SMTP verification failed' };
    }

    // Save encrypted credentials
    await this.emailCredentialsService.saveCredentials(businessId, email, password);
    return { success: true, verified: true, message: 'Email credentials saved and verified' };
  }

  @Get(':businessId')
  async getCredentials(@Param('businessId') businessId: string) {
    const credentials = await this.emailCredentialsService.getCredentials(businessId);
    if (credentials) {
      return { email: credentials.email, smtpServer: credentials.smtpServer, smtpPort: credentials.smtpPort };
    }
    return { error: 'Credentials not found' };
  }

  @Get(':businessId/full')
  async getFullCredentials(@Param('businessId') businessId: string, @Req() req: Request) {
    const auth = req.header('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    const internalKey = process.env.BACKEND_API_KEY || '';
    if (!internalKey || token !== internalKey) {
      throw new ForbiddenException('Unauthorized');
    }

    const credentials = await this.emailCredentialsService.getDecryptedCredentials(businessId);
    if (credentials) {
      return credentials;
    }
    return { error: 'Credentials not found or not decryptable' };
  }
}
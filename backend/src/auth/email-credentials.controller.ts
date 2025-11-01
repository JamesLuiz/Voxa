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
    @Body() body: { businessId: string; email: string; apiKey?: string },
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
    const { businessId, email, apiKey } = body;

    // If an apiKey was provided by the user, verify and save it (encrypted).
    if (apiKey && apiKey.trim()) {
      const verify = await this.emailCredentialsService.verifySendGrid(email, apiKey);
      if (!verify.ok) {
        return { success: false, verified: false, message: verify.message || 'SendGrid verification failed' };
      }

      await this.emailCredentialsService.saveCredentials(businessId, email, apiKey);
      return { success: true, verified: true, saved: true, message: 'SendGrid API key saved and verified' };
    }

    // No apiKey supplied by user: fall back to server-wide SEND_GRID if configured.
    const serverKey = process.env.SEND_GRID || '';
    if (serverKey) {
      // Verify server key can send to the provided email (do not persist server key).
      const verify = await this.emailCredentialsService.verifySendGrid(email, serverKey);
      if (!verify.ok) {
        return { success: false, verified: false, message: verify.message || 'Server SendGrid verification failed' };
      }
      return { success: true, verified: true, saved: false, message: 'Using server SendGrid key (not saved)' };
    }

    // Neither user apiKey nor server key available: instruct user to provide one.
    return { success: false, verified: false, message: 'No SendGrid API key provided and no server default configured. Provide an API key or configure SEND_GRID in environment.' };
  }

  @Get(':businessId')
  async getCredentials(@Param('businessId') businessId: string) {
    const credentials = await this.emailCredentialsService.getCredentials(businessId);
    if (credentials) {
      return { email: credentials.email, hasSendGrid: !!credentials.sendgridApiKey, smtpServer: credentials.smtpServer, smtpPort: credentials.smtpPort };
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
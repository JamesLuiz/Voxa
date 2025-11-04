import { Body, Controller, Post } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as jwt from 'jsonwebtoken';
import { GeneralUser, GeneralUserDocument } from '../schemas/general-user.schema';
import { GeneralRegisterDto, GeneralLoginDto } from '../dto/general-auth.dto';

@Controller('api/auth/general')
export class GeneralAuthController {
  constructor(@InjectModel(GeneralUser.name) private generalModel: Model<GeneralUserDocument>) {}

  @Post('register')
  async register(@Body() body: GeneralRegisterDto) {
    const email = String(body.email).trim().toLowerCase();
    const existing = await this.generalModel.findOne({ email }).lean();
    if (existing) {
      // Idempotent register: return existing token
      const token = jwt.sign({ sub: email, role: 'general', userId: String((existing as any)._id) }, process.env.JWT_SECRET || 'change-me', { expiresIn: '30d' });
      return { token, user: { name: existing.name, email, role: 'general', location: existing.location } };
    }

    const created = await this.generalModel.create({
      name: body.name,
      email,
      location: body.location,
      conversationHistory: [],
      lastInteraction: new Date(),
    });

    const token = jwt.sign({ sub: email, role: 'general', userId: created._id.toString() }, process.env.JWT_SECRET || 'change-me', { expiresIn: '30d' });
    return { token, user: { name: created.name, email, role: 'general', location: created.location } };
  }

  @Post('login')
  async login(@Body() body: GeneralLoginDto) {
    const email = String(body.email).trim().toLowerCase();
    const user = await this.generalModel.findOne({ email }).lean();
    if (!user) {
      // Auto-register on first login for frictionless experience
      const created = await this.generalModel.create({ name: email.split('@')[0], email, location: 'unknown', conversationHistory: [], lastInteraction: new Date() });
      const tokenNew = jwt.sign({ sub: email, role: 'general', userId: created._id.toString() }, process.env.JWT_SECRET || 'change-me', { expiresIn: '30d' });
      return { token: tokenNew, user: { name: created.name, email, role: 'general', location: created.location } };
    }
    const token = jwt.sign({ sub: email, role: 'general', userId: String((user as any)._id) }, process.env.JWT_SECRET || 'change-me', { expiresIn: '30d' });
    return { token, user: { name: user.name, email, role: 'general', location: user.location } };
  }
}



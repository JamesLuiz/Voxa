import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Business, BusinessDocument } from '../schemas/business.schema';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(@InjectModel(Business.name) private businessModel: Model<BusinessDocument>) {}

  async register(payload: {
    owner: { name: string; email: string; password: string };
    business: {
      name: string;
      industry: string;
      description?: string;
      products?: string[];
      policies?: string;
      phone: string;
      email: string;
      website?: string;
    };
  }) {
    const { owner, business } = payload;

    const existing = await this.businessModel.findOne({ 'owner.email': owner.email }).lean();
    if (existing) {
      throw new UnauthorizedException('Owner already registered');
    }

    const passwordHash = await bcrypt.hash(owner.password, 10);

    const created = await this.businessModel.create({
      ...business,
      owner: { name: owner.name, email: owner.email, passwordHash },
      agentConfig: {},
    });

    const token = jwt.sign(
      { sub: created.owner.email, role: 'owner', businessId: created._id.toString() },
      process.env.JWT_SECRET || 'change-me',
      { expiresIn: '7d' },
    );

    return {
      token,
      user: { name: created.owner.name, email: created.owner.email, role: 'owner' },
      businessId: created._id.toString(),
    };
  }
}



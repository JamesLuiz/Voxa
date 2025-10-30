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

    // Normalize business name to slug: lowercase, alphanumerics and hyphens
    const slug = business.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const nameClash = await this.businessModel.findOne({ slug }).lean();
    if (nameClash) {
      throw new UnauthorizedException('Business name is already taken');
    }

    const created = await this.businessModel.create({
      ...business,
      slug,
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

  async login(payload: { email: string; password: string }) {
    const { email, password } = payload;
    const found = await this.businessModel.findOne({ 'owner.email': email }).lean();
    if (!found) throw new UnauthorizedException('Invalid credentials');

    const match = await bcrypt.compare(password, found.owner.passwordHash);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    const token = jwt.sign({ sub: found.owner.email, role: 'owner', businessId: found._id.toString() }, process.env.JWT_SECRET || 'change-me', {
      expiresIn: '7d',
    });

    return {
      token,
      user: { name: found.owner.name, email: found.owner.email, role: 'owner' },
      businessId: found._id.toString(),
    };
  }
}



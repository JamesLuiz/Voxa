import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Business, BusinessSchema } from '../schemas/business.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Business.name, schema: BusinessSchema }])],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}



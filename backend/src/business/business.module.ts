import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Business, BusinessSchema } from '../schemas/business.schema';
import { BusinessController } from './business.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Business.name, schema: BusinessSchema }])],
  controllers: [BusinessController],
})
export class BusinessModule {}



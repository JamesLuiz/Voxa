import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Business, BusinessSchema } from '../schemas/business.schema';
import { ConfigController } from './config.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Business.name, schema: BusinessSchema }])],
  controllers: [ConfigController],
})
export class ConfigModule {}



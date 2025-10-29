import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Customer, CustomerSchema } from '../schemas/customer.schema';
import { CrmController } from './crm.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Customer.name, schema: CustomerSchema }])],
  controllers: [CrmController],
})
export class CrmModule {}


